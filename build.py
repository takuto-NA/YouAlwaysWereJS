#!/usr/bin/env python3
"""
ビルドスクリプト

このファイルの役割:
- プロダクションビルドを実行
- 型チェック → ビルド → サイズ確認の流れを自動化

使い方:
  python build.py              # Web版ビルド
  python build.py --tauri      # Tauri版ビルド
  python build.py --check-only # 型チェックのみ
"""

import subprocess
import sys
import argparse
from pathlib import Path


def get_npm_command():
    """
    OSに応じた npm コマンドを返す
    なぜ必要: Windowsでは npm.cmd、Unix系では npm を使用
    """
    if sys.platform == "win32":
        return "npm.cmd"
    return "npm"


def run_command(command, description):
    """
    コマンドを実行して結果を表示
    なぜ関数化: DRY原則（同じコマンド実行処理を共通化）
    """
    print(f"\n{'='*60}")
    print(f"🔧 {description}")
    print(f"{'='*60}\n")

    try:
        result = subprocess.run(command, check=True, shell=True)
        print(f"\n✅ {description} 完了")
        return True
    except subprocess.CalledProcessError as error:
        print(f"\n❌ {description} 失敗: {error}")
        return False


def check_types():
    """型チェックを実行"""
    npm_cmd = get_npm_command()
    return run_command(f"{npm_cmd} run type-check", "TypeScript型チェック")


def build_web():
    """Web版をビルド"""
    npm_cmd = get_npm_command()

    if not run_command(f"{npm_cmd} run build", "Web版ビルド"):
        return False

    # ビルド結果の確認
    dist_path = Path("dist")
    if dist_path.exists():
        print(f"\n📦 ビルド成果物: {dist_path.absolute()}")

        # ファイルサイズを表示
        total_size = sum(f.stat().st_size for f in dist_path.rglob('*') if f.is_file())
        print(f"📊 合計サイズ: {total_size / 1024 / 1024:.2f} MB")

    return True


def build_tauri():
    """Tauri版をビルド"""
    npm_cmd = get_npm_command()
    return run_command(f"{npm_cmd} run tauri:build", "Tauri版ビルド")


def main():
    parser = argparse.ArgumentParser(
        description="ビルドスクリプト",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        "--tauri",
        action="store_true",
        help="Tauri版（デスクトップアプリ）をビルド"
    )

    parser.add_argument(
        "--check-only",
        action="store_true",
        help="型チェックのみ実行（ビルドしない）"
    )

    parser.add_argument(
        "--skip-check",
        action="store_true",
        help="型チェックをスキップしてビルド"
    )

    args = parser.parse_args()

    print("🚀 ビルドプロセス開始")

    # 型チェック
    if not args.skip_check:
        if not check_types():
            print("\n❌ 型エラーがあります。修正してください。")
            print("💡 --skip-check オプションで型チェックをスキップできます")
            sys.exit(1)

    # チェックのみの場合はここで終了
    if args.check_only:
        print("\n✅ 型チェック完了")
        sys.exit(0)

    # ビルド実行
    if args.tauri:
        success = build_tauri()
    else:
        success = build_web()

    if success:
        print("\n" + "="*60)
        print("🎉 ビルド完了！")
        print("="*60)
        sys.exit(0)
    else:
        print("\n❌ ビルド失敗")
        sys.exit(1)


if __name__ == "__main__":
    main()
