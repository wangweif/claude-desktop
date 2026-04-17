import { build as electronBuilder } from 'electron-builder'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  const args = process.argv.slice(2)
  const platform = args.find((a) => a.startsWith('--mac')) ? 'mac' :
                   args.find((a) => a.startsWith('--win')) ? 'win' : null

  const config = {
    config: {
      appId: 'com.claude-installer.desktop',
      productName: 'Claude Desktop Installer',
      directories: {
        output: resolve(__dirname, '../release'),
      },
      files: [
        'dist/**/*',
        'dist-electron/**/*',
      ],
      mac: {
        target: [
          {
            target: 'dmg',
            arch: ['x64', 'arm64'],
          },
        ],
        category: 'public.app-category.developer-tools',
      },
      win: {
        target: [
          {
            target: 'nsis',
            arch: ['x64'],
          },
        ],
      },
      nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: 'Claude Desktop Installer',
      },
      dmg: {
        contents: [
          { x: 130, y: 220 },
          { x: 410, y: 220, type: 'link', path: '/Applications' },
        ],
      },
    },
    ...(platform ? { [platform]: true } : {}),
  }

  try {
    await electronBuilder(config)
    console.log('Build complete!')
  } catch (err) {
    console.error('Build failed:', err)
    process.exit(1)
  }
}

main()
