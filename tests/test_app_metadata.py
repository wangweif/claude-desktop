"""Tests for backend.app_metadata — changelog parsing."""

import textwrap

from backend.app_metadata import parse_latest_version_block


class TestParseLatestVersionBlock:
    def test_bracket_heading_with_date(self):
        text = textwrap.dedent("""\
            ## [1.2.3] - 2026-04-19

            ### Added
            - new feature
            ### Fixed
            - bug fix

            ## [1.2.2] - 2026-03-01
            - old
        """)
        version, body = parse_latest_version_block(text)
        assert version == "1.2.3"
        assert "new feature" in body
        assert "bug fix" in body
        assert "old" not in body

    def test_bracket_heading_no_date(self):
        text = textwrap.dedent("""\
            ## [0.5.0]

            - something
        """)
        version, body = parse_latest_version_block(text)
        assert version == "0.5.0"
        assert "something" in body

    def test_plain_heading(self):
        text = textwrap.dedent("""\
            ## 2.0.0
            - major release
        """)
        version, body = parse_latest_version_block(text)
        assert version == "2.0.0"
        assert "major release" in body

    def test_plain_heading_with_v_prefix(self):
        text = textwrap.dedent("""\
            ## v3.1.0
            - tagged release
        """)
        version, body = parse_latest_version_block(text)
        assert version == "v3.1.0"

    def test_empty_string(self):
        version, body = parse_latest_version_block("")
        assert version is None
        assert body == ""

    def test_no_version_heading(self):
        text = "Just some text\nwithout version headings"
        version, body = parse_latest_version_block(text)
        assert version is None
        assert body == ""

    def test_stops_at_next_heading(self):
        text = textwrap.dedent("""\
            ## [1.0.0]
            - feature A

            ## [0.9.0]
            - old feature
        """)
        version, body = parse_latest_version_block(text)
        assert version == "1.0.0"
        assert "feature A" in body
        assert "old feature" not in body

    def test_whitespace_only_body(self):
        text = "## [1.0.0]\n\n   \n"
        version, body = parse_latest_version_block(text)
        assert version == "1.0.0"
        assert body == ""

    def test_real_changelog(self):
        """Regression: verify parsing against actual CHANGELOG.md format."""
        text = textwrap.dedent("""\
            # Changelog

            ## [0.0.1] - 2026-04-19

            ### 新增
            - 设置页「关于」

            ### 变更
            - 无

            ## [0.0.0] - 2026-04-01

            ### 新增
            - 初版 Claude Desktop
        """)
        version, body = parse_latest_version_block(text)
        assert version == "0.0.1"
        assert "关于" in body
        assert "初版" not in body
