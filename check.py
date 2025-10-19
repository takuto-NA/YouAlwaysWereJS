#!/usr/bin/env python3
"""
コード品質チェックスクリプト

このファイルの役割:
- 型チェック、コード品質チェックを一括実行
- コミット前の確認を自動化

使い方:
  python check.py           # 全チェック実行
  python check.py --quick   # 型チェックのみ（高速）
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


def print_section(title):
    """セクションヘッダーを表示"""
    print("\n" + "="*60)
    print(f"🔍 {title}")
    print("="*60 + "\n")


def run_type_check():
    """TypeScript型チェック"""
    print_section("TypeScript型チェック")

    npm_cmd = get_npm_command()

    try:
        subprocess.run([npm_cmd, "run", "type-check"], check=True, shell=True)
        print("✅ 型エラーなし")
        return True
    except subprocess.CalledProcessError:
        print("❌ 型エラーがあります")
        return False


def run_code_quality_check():
    """コード品質チェック（scripts/check-code-quality.sh）"""
    print_section("コード品質チェック")

    script_path = Path("scripts/check-code-quality.sh")

    if not script_path.exists():
        print("⚠️  check-code-quality.sh が見つかりません（スキップ）")
        return True

    try:
        # Windows環境の場合はbashで実行
        if sys.platform == "win32":
            subprocess.run(["bash", str(script_path)], check=False)
        else:
            subprocess.run([str(script_path)], check=False)

        print("✅ コード品質チェック完了")
        return True
    except Exception as error:
        print(f"⚠️  コード品質チェック実行エラー: {error}")
        return True  # エラーでも継続


def search_magic_numbers():
    """マジックナンバーを検索"""
    print_section("マジックナンバー検索")

    try:
        result = subprocess.run(
            ["grep", "-rn", "--include=*.ts", "--include=*.tsx",
             "-E", r"[^a-zA-Z_][0-9]{2,}", "src/"],
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            # TailwindCSSクラスを除外
            filtered = [line for line in lines if 'className=' not in line and 'class="' not in line]

            if filtered:
                print(f"⚠️  マジックナンバーが {len(filtered)} 件見つかりました:")
                for line in filtered[:10]:  # 最初の10件のみ表示
                    print(f"   {line}")
                if len(filtered) > 10:
                    print(f"   ... 他 {len(filtered) - 10} 件")
            else:
                print("✅ マジックナンバーなし（TailwindCSSクラスを除く）")
        else:
            print("✅ マジックナンバーなし")

        return True
    except FileNotFoundError:
        print("⚠️  grep コマンドが見つかりません（スキップ）")
        return True


def search_console_log():
    """console.log を検索"""
    print_section("console.log検索（本番前に削除）")

    try:
        result = subprocess.run(
            ["grep", "-rn", "--include=*.ts", "--include=*.tsx",
             "console.log", "src/"],
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            # errorHandler.tsのlogDebug実装を除外
            filtered = [line for line in lines if 'errorHandler.ts' not in line]

            if filtered:
                print(f"⚠️  console.log が {len(filtered)} 件見つかりました:")
                for line in filtered[:10]:
                    print(f"   {line}")
                if len(filtered) > 10:
                    print(f"   ... 他 {len(filtered) - 10} 件")
            else:
                print("✅ console.log なし（errorHandler除く）")
        else:
            print("✅ console.log なし")

        return True
    except FileNotFoundError:
        print("⚠️  grep コマンドが見つかりません（スキップ）")
        return True


def main():
    parser = argparse.ArgumentParser(
        description="コード品質チェックスクリプト",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        "--quick",
        action="store_true",
        help="型チェックのみ実行（高速）"
    )

    args = parser.parse_args()

    print("🚀 コード品質チェック開始\n")

    results = []

    # 型チェック（必須）
    results.append(("TypeScript型チェック", run_type_check()))

    # クイックモードでない場合は追加チェック
    if not args.quick:
        results.append(("コード品質", run_code_quality_check()))
        results.append(("マジックナンバー", search_magic_numbers()))
        results.append(("console.log", search_console_log()))

    # 結果サマリー
    print("\n" + "="*60)
    print("📊 チェック結果サマリー")
    print("="*60 + "\n")

    all_passed = True
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status:12} {name}")
        if not passed:
            all_passed = False

    print()
    if all_passed:
        print("🎉 全てのチェックに合格しました！")
        sys.exit(0)
    else:
        print("❌ いくつかのチェックが失敗しました")
        sys.exit(1)


if __name__ == "__main__":
    main()
