#!/usr/bin/env python3
"""
開発サーバー起動スクリプト

このファイルの役割:
- npm run dev を実行して開発サーバーを起動
- ブラウザを自動的に開く
- Tauri版も選択可能

使い方:
  python dev.py           # Web版（ブラウザ）
  python dev.py --tauri   # デスクトップ版（Tauri）
  python dev.py --help    # ヘルプ表示
"""

import subprocess
import sys
import time
import webbrowser
import argparse
from pathlib import Path


# 設定
DEV_SERVER_URL = "http://localhost:1420"
WAIT_TIME_SECONDS = 3  # サーバー起動待機時間


def get_npm_command():
    """
    OSに応じた npm コマンドを返す
    なぜ必要: Windowsでは npm.cmd、Unix系では npm を使用
    """
    if sys.platform == "win32":
        return "npm.cmd"
    return "npm"


def check_node_modules():
    """
    node_modules が存在するか確認
    なぜ必要: npm install が実行されていない場合にエラーを防ぐ
    """
    node_modules = Path("node_modules")
    if not node_modules.exists():
        print("❌ node_modules が見つかりません")
        print("📦 npm install を実行してください:")
        print("   npm install")
        return False
    return True


def start_web_dev():
    """
    Web版開発サーバーを起動
    ブラウザを自動的に開く
    """
    print("🚀 Web版開発サーバーを起動中...")
    print(f"📍 URL: {DEV_SERVER_URL}")
    print()

    npm_cmd = get_npm_command()

    try:
        # npm run dev をバックグラウンドで起動
        process = subprocess.Popen(
            [npm_cmd, "run", "dev"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            shell=True  # Windows互換性のため
        )

        # サーバー起動を待機
        print(f"⏳ サーバー起動中... ({WAIT_TIME_SECONDS}秒待機)")
        time.sleep(WAIT_TIME_SECONDS)

        # ブラウザを開く
        print(f"🌐 ブラウザを開きます: {DEV_SERVER_URL}")
        webbrowser.open(DEV_SERVER_URL)

        print()
        print("✅ 開発サーバー起動完了！")
        print()
        print("📝 操作方法:")
        print("   - ブラウザでゲームが表示されます")
        print("   - コード変更時に自動リロード（HMR）")
        print("   - Ctrl+C で終了")
        print()

        # サーバーの出力を表示
        try:
            for line in process.stdout:
                print(line, end='')
        except KeyboardInterrupt:
            print("\n⏹️  サーバーを停止中...")
            process.terminate()
            process.wait()
            print("✅ 停止しました")

    except FileNotFoundError:
        print("❌ npm が見つかりません")
        print("📦 Node.js がインストールされているか確認してください")
        sys.exit(1)
    except Exception as error:
        print(f"❌ エラー: {error}")
        sys.exit(1)


def start_tauri_dev():
    """
    Tauri版（デスクトップアプリ）を起動
    """
    print("🚀 Tauri版（デスクトップアプリ）を起動中...")
    print()

    npm_cmd = get_npm_command()

    try:
        # npm run tauri:dev を実行
        subprocess.run([npm_cmd, "run", "tauri:dev"], check=True, shell=True)

    except FileNotFoundError:
        print("❌ npm が見つかりません")
        print("📦 Node.js がインストールされているか確認してください")
        sys.exit(1)
    except subprocess.CalledProcessError as error:
        print(f"❌ Tauri起動エラー: {error}")
        print()
        print("💡 Tauriの設定を確認してください:")
        print("   - src-tauri/tauri.conf.json")
        print("   - アイコンファイルの配置")
        sys.exit(1)
    except Exception as error:
        print(f"❌ エラー: {error}")
        sys.exit(1)


def main():
    """
    メイン処理
    コマンドライン引数を解析して適切な起動モードを選択
    """
    parser = argparse.ArgumentParser(
        description="開発サーバー起動スクリプト",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  python dev.py           # Web版（ブラウザ自動起動）
  python dev.py --tauri   # デスクトップ版（Tauri）
  python dev.py --help    # このヘルプを表示
        """
    )

    parser.add_argument(
        "--tauri",
        action="store_true",
        help="Tauri版（デスクトップアプリ）を起動"
    )

    args = parser.parse_args()

    # node_modules チェック
    if not check_node_modules():
        sys.exit(1)

    # 起動モード選択
    if args.tauri:
        start_tauri_dev()
    else:
        start_web_dev()


if __name__ == "__main__":
    main()
