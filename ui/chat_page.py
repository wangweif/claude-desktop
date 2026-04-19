"""Chat page for interacting with Claude Code directly from the GUI."""

import json
import os
import subprocess

import markdown
from PySide6.QtCore import Qt, QTimer, Signal, QThread
from PySide6.QtWidgets import (
    QHBoxLayout, QLabel, QLineEdit, QPushButton, QTextBrowser,
    QVBoxLayout, QWidget,
)
from backend import cli
from .theme import (
    BG_PRIMARY, BG_SECONDARY, BG_TERTIARY, BORDER, BORDER_LIGHT, BRAND, BRAND_BG,
    TEXT_MUTED, TEXT_SECONDARY, TEXT_PRIMARY, TEXT_FAINT, TEXT_DANGER,
)


class ChatWorker(QThread):
    """Spawns claude CLI per message, streams output via signals."""

    token_received = Signal(str)
    tool_used = Signal(str)
    response_complete = Signal(dict)
    error_occurred = Signal(str)

    def __init__(self, message: str, session_id: str | None = None, parent=None):
        super().__init__(parent)
        self._message = message
        self._session_id = session_id
        self._process: subprocess.Popen | None = None

    def run(self):
        claude_bin = cli.get_claude_path()
        if not claude_bin:
            self.error_occurred.emit("未找到 Claude Code，请先在设置中安装")
            return

        cmd = [
            claude_bin, "-p", self._message,
            "--output-format", "stream-json",
            "--verbose",
            "--dangerously-skip-permissions",
        ]
        if self._session_id:
            cmd.extend(["--resume", self._session_id])

        env = {**os.environ, "PATH": cli.get_augmented_path()}

        try:
            self._process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
                cwd=os.getcwd(),
            )
            if not self._process.stdout:
                self.error_occurred.emit("无法启动 Claude Code 进程")
                return

            accumulated_text = ""
            for line in self._process.stdout:
                if self.isInterruptionRequested():
                    self._process.terminate()
                    return
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue

                msg_type = data.get("type")
                if msg_type == "assistant":
                    content_list = data.get("message", {}).get("content", [])
                    for block in content_list:
                        btype = block.get("type")
                        if btype == "text":
                            text = block.get("text", "")
                            if text and text != accumulated_text:
                                self.token_received.emit(text)
                                accumulated_text = text
                        elif btype == "tool_use":
                            name = block.get("name", "unknown")
                            inp = block.get("input", {})
                            summary = self._tool_summary(name, inp)
                            self.tool_used.emit(f"{name}: {summary}")
                elif msg_type == "result":
                    self.response_complete.emit(data)

            self._process.wait(timeout=10)

            if self._process.returncode and self._process.returncode != 0:
                stderr = ""
                if self._process.stderr:
                    stderr = self._process.stderr.read().strip()
                if stderr:
                    self.error_occurred.emit(f"Claude Code 退出 ({self._process.returncode}): {stderr[:200]}")

        except Exception as e:
            self.error_occurred.emit(f"启动失败: {e}")

    def stop(self):
        self.requestInterruption()
        if self._process:
            try:
                self._process.terminate()
                self._process.wait(timeout=3)
            except Exception:
                try:
                    self._process.kill()
                except Exception:
                    pass

    @staticmethod
    def _tool_summary(name: str, inp: dict) -> str:
        if name == "Bash":
            return inp.get("command", "")[:80]
        if name == "Read":
            return inp.get("file_path", "")
        if name == "Edit":
            return inp.get("file_path", "")
        if name == "Write":
            return inp.get("file_path", "")
        if name == "Grep":
            return inp.get("pattern", "")
        if name == "Glob":
            return inp.get("pattern", "")
        if name == "WebSearch":
            return inp.get("query", "")[:60]
        return str(inp)[:60]


class ChatPage(QWidget):
    """Chat interface with message history and input."""

    navigate_settings = Signal()

    SUGGESTED_PROMPTS = [
        "帮我检查一下这个项目的代码",
        "解释一下这个项目的架构",
        "帮我写一个 Python 脚本",
    ]

    def __init__(self, parent=None):
        super().__init__(parent)
        self._session_id: str | None = None
        self._worker: ChatWorker | None = None
        self._is_responding = False
        self._typing_dots_timer = QTimer(self)
        self._typing_dots_timer.timeout.connect(self._update_typing_dots)
        self._typing_dots_count = 0
        self._typing_html_id = ""
        self._build_ui()

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        # Header
        header = QHBoxLayout()
        title = QLabel("对话")
        title.setStyleSheet("font-size: 16px; font-weight: 600;")
        header.addWidget(title)
        header.addStretch()

        self._new_btn = QPushButton("新对话")
        self._new_btn.setProperty("secondary", True)
        self._new_btn.setFixedHeight(32)
        self._new_btn.clicked.connect(self._new_conversation)
        header.addWidget(self._new_btn)

        self._cost_label = QLabel("")
        self._cost_label.setStyleSheet(f"color: {TEXT_FAINT}; font-size: 11px;")
        header.addWidget(self._cost_label)
        layout.addLayout(header)

        # Separator
        sep = QLabel()
        sep.setFixedHeight(1)
        sep.setStyleSheet(f"background-color: {BORDER};")
        layout.addWidget(sep)

        # Message area
        self._messages = QTextBrowser()
        self._messages.setOpenExternalLinks(False)
        self._messages.setStyleSheet(f"""
            QTextBrowser {{
                background-color: {BG_SECONDARY};
                border: 1px solid {BORDER};
                border-radius: 10px;
                padding: 16px;
                color: {TEXT_PRIMARY};
                font-size: 13px;
                line-height: 1.5;
            }}
            QTextBrowser code {{
                background-color: {BG_PRIMARY};
                padding: 2px 6px;
                border-radius: 4px;
                font-family: "SF Mono", "Menlo", monospace;
                font-size: 12px;
            }}
            QTextBrowser pre {{
                background-color: {BG_PRIMARY};
                padding: 10px 14px;
                border-radius: 6px;
                font-family: "SF Mono", "Menlo", monospace;
                font-size: 12px;
                overflow-x: auto;
            }}
        """)
        layout.addWidget(self._messages, 1)

        # Input bar
        input_row = QHBoxLayout()
        input_row.setSpacing(8)

        self._input = QLineEdit()
        self._input.setPlaceholderText("输入消息...")
        self._input.setFixedHeight(40)
        self._input.returnPressed.connect(self._send_message)
        input_row.addWidget(self._input, 1)

        self._send_btn = QPushButton("发送")
        self._send_btn.setFixedSize(72, 40)
        self._send_btn.clicked.connect(self._send_message)
        input_row.addWidget(self._send_btn)

        self._stop_btn = QPushButton("停止")
        self._stop_btn.setProperty("danger", True)
        self._stop_btn.setFixedSize(72, 40)
        self._stop_btn.setVisible(False)
        self._stop_btn.clicked.connect(self._stop_response)
        input_row.addWidget(self._stop_btn)

        layout.addLayout(input_row)

        # Empty state with suggested prompts
        self._show_empty_state()

    def _show_empty_state(self):
        prompt_buttons = ""
        for prompt in self.SUGGESTED_PROMPTS:
            escaped = self._escape(prompt)
            prompt_buttons += f"""
                <div style="margin: 8px 0; text-align: center;">
                    <span style="color: {TEXT_MUTED}; border: 1px solid {BORDER_LIGHT};
                        padding: 6px 16px; border-radius: 6px; cursor: pointer;
                        font-size: 12px;">{escaped}</span>
                </div>
            """
        self._messages.setHtml(f"""
            <div style="text-align:center; padding: 60px 20px; color: {TEXT_MUTED};">
                <div style="font-size: 14px; margin-bottom: 8px;">开始与 Claude Code 对话</div>
                <div style="font-size: 12px; color: {TEXT_FAINT}; margin-bottom: 24px;">
                    在下方输入消息，或选择一个建议开始
                </div>
                {prompt_buttons}
            </div>
        """)
        # Handle click on suggested prompts
        self._messages.anchorClicked.connect(self._on_suggested_prompt)

    def _on_suggested_prompt(self, url):
        text = url.toString().strip()
        if text:
            self._input.setText(text)
            self._send_message()

    def _append_message(self, role: str, content: str):
        if role == "user":
            html = f"""
                <div style="margin: 12px 0; text-align: right;">
                    <span style="display: inline-block; background-color: {BG_TERTIARY};
                        color: {TEXT_PRIMARY}; padding: 8px 14px;
                        border-radius: 10px 10px 2px 10px;
                        max-width: 80%; text-align: left; font-size: 13px;">
                        {self._escape(content)}
                    </span>
                </div>
            """
        else:
            rendered = markdown.markdown(
                content, extensions=["fenced_code", "tables", "codehilite"]
            )
            html = f"""
                <div style="margin: 12px 0;">
                    <span style="display: inline-block; background-color: {BG_TERTIARY};
                        color: {TEXT_PRIMARY}; padding: 8px 14px;
                        border-radius: 10px 10px 10px 2px;
                        max-width: 80%; font-size: 13px;">
                        {rendered}
                    </span>
                </div>
            """
        self._messages.append(html)
        self._scroll_to_bottom()

    def _append_tool(self, summary: str):
        html = f"""
            <div style="margin: 4px 0; padding-left: 8px;">
                <span style="color: {TEXT_MUTED}; font-size: 12px; font-family: monospace;">
                    {self._escape(summary)}
                </span>
            </div>
        """
        self._messages.append(html)
        self._scroll_to_bottom()

    def _append_error(self, msg: str):
        html = f"""
            <div style="margin: 8px 0; padding: 8px 12px;
                background-color: rgba(248,113,113,0.08);
                border-radius: 6px;">
                <span style="color: {TEXT_DANGER}; font-size: 12px;">
                    {self._escape(msg)}
                </span>
            </div>
        """
        self._messages.append(html)
        self._scroll_to_bottom()

    def _show_typing_indicator(self):
        self._typing_dots_count = 0
        self._typing_html_id = f"typing-{id(self)}"
        self._typing_dots_timer.start(400)
        self._update_typing_dots()

    def _hide_typing_indicator(self):
        self._typing_dots_timer.stop()

    def _update_typing_dots(self):
        self._typing_dots_count = (self._typing_dots_count % 3) + 1
        dots = "." * self._typing_dots_count
        cursor = self._messages.textCursor()
        # Find and remove previous typing indicator
        doc = self._messages.document()
        block = doc.findBlockByText(f"typing-dot-marker")
        if block.isValid():
            cursor.setPosition(block.position(), cursor.MoveMode.MoveAnchor)
            cursor.movePosition(cursor.MoveOperation.EndOfBlock, cursor.MoveMode.KeepAnchor)
            cursor.removeSelectedText()
        self._messages.append(f"""
            <div id="{self._typing_html_id}" style="margin: 8px 0; padding-left: 4px;">
                <span style="color: {TEXT_MUTED}; font-size: 14px; letter-spacing: 2px;">
                    {dots}
                </span>
            </div>
        """)
        self._scroll_to_bottom()

    def _send_message(self):
        text = self._input.text().strip()
        if not text or self._is_responding:
            return

        # Clear empty state on first message
        if not self._session_id:
            self._messages.anchorClicked.disconnect(self._on_suggested_prompt)
            self._messages.clear()

        self._input.clear()
        self._append_message("user", text)
        self._set_responding(True)
        self._show_typing_indicator()

        self._worker = ChatWorker(text, self._session_id, parent=self)
        self._worker.token_received.connect(self._on_token)
        self._worker.tool_used.connect(self._on_tool)
        self._worker.response_complete.connect(self._on_complete)
        self._worker.error_occurred.connect(self._on_error)
        self._worker.finished.connect(self._on_worker_finished)
        self._worker.start()

    def _on_token(self, text: str):
        self._hide_typing_indicator()
        self._append_message("assistant", text)

    def _on_tool(self, summary: str):
        self._hide_typing_indicator()
        self._append_tool(summary)

    def _on_complete(self, result: dict):
        self._hide_typing_indicator()
        sid = result.get("session_id")
        if sid:
            self._session_id = sid
        cost = result.get("total_cost_usd", 0)
        if cost > 0:
            self._cost_label.setText(f"${cost:.4f}")

    def _on_error(self, msg: str):
        self._hide_typing_indicator()
        self._append_error(msg)

    def _on_worker_finished(self):
        self._hide_typing_indicator()
        self._set_responding(False)

    def _stop_response(self):
        if self._worker:
            self._worker.stop()
            self._hide_typing_indicator()
            self._append_message("assistant", "（已停止）")

    def _new_conversation(self):
        if self._worker and self._is_responding:
            self._worker.stop()
        self._hide_typing_indicator()
        self._session_id = None
        self._cost_label.setText("")
        self._messages.clear()
        self._show_empty_state()
        self._set_responding(False)

    def _set_responding(self, responding: bool):
        self._is_responding = responding
        self._input.setEnabled(not responding)
        self._send_btn.setVisible(not responding)
        self._stop_btn.setVisible(responding)
        self._new_btn.setEnabled(not responding)
        if responding:
            self._input.setPlaceholderText("Claude 正在思考...")
        else:
            self._input.setPlaceholderText("输入消息...")
            self._input.setFocus()

    def _scroll_to_bottom(self):
        self._messages.verticalScrollBar().setValue(
            self._messages.verticalScrollBar().maximum()
        )

    @staticmethod
    def _escape(text: str) -> str:
        return (
            text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
        )
