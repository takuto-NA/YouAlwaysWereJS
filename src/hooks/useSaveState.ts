/**
 * 保存処理用カスタムフック
 * 保存状態の管理と保存後の自動クローズ処理を提供
 */
import { useState } from "react";
import { SAVE_MESSAGE_TIMEOUT_MS } from "../constants/animations";

interface UseSaveStateOptions {
  onClose: () => void;
}

export function useSaveState({ onClose }: UseSaveStateOptions) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  /**
   * 保存処理を実行するヘルパー関数
   * @param saveAction 実際の保存処理を行う関数
   * @param successMessage 成功時のメッセージ（デフォルト: "SAVED"）
   */
  const executeSave = async (
    saveAction: () => void | Promise<void>,
    successMessage: string = "SAVED"
  ) => {
    try {
      setIsSaving(true);
      await saveAction();
      setSaveMessage(successMessage);

      // 保存完了メッセージを一定時間後に消去してモーダルを閉じる
      setTimeout(() => {
        setSaveMessage("");
        onClose();
      }, SAVE_MESSAGE_TIMEOUT_MS);
    } catch (error) {
      setSaveMessage("ERROR: Failed to save");
      console.error("Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 保存メッセージをリセット
   */
  const resetSaveMessage = () => {
    setSaveMessage("");
  };

  return {
    isSaving,
    saveMessage,
    executeSave,
    resetSaveMessage,
  };
}
