/**
 * 保存ボタンコンポーネント
 * 保存状態に応じて表示を動的に変更
 */
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface SaveButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isSaving: boolean;
  saveMessage: string;
}

function SaveButton({ onClick, disabled = false, isSaving, saveMessage }: SaveButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-8 py-2.5 border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black flex items-center justify-center gap-2 ${
        saveMessage.startsWith("SAVED")
          ? "bg-green-600 text-white border-green-600"
          : saveMessage.startsWith("ERROR")
          ? "bg-red-600 text-white border-red-600"
          : "bg-white text-black hover:bg-gray-200 border-white disabled:hover:bg-white"
      }`}
    >
      {saveMessage.startsWith("SAVED") ? (
        <>
          <CheckCircleIcon className="w-5 h-5" />
          <span>Saved</span>
        </>
      ) : saveMessage.startsWith("ERROR") ? (
        <>
          <XCircleIcon className="w-5 h-5" />
          <span>Error</span>
        </>
      ) : isSaving ? (
        "Saving..."
      ) : (
        "Save"
      )}
    </button>
  );
}

export default SaveButton;
