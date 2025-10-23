/**
 * Tracks save lifecycle for settings dialogs.
 * Why it matters: centralised handling keeps user feedback and cleanup timers consistent
 * across every modal that persists data.
 */
import { useState } from "react";
import { SAVE_MESSAGE_TIMEOUT_MS } from "../constants/animations";
import { getErrorMessage, logError, logWarning } from "../utils/errorHandler";

interface UseSaveStateOptions {
  onClose: () => void;
}

const SAVE_HOOK_CONTEXT = "useSaveState";
const DEFAULT_SUCCESS_MESSAGE = "SAVED";
const SAVE_ERROR_MESSAGE = "ERROR: Failed to save";

export function useSaveState({ onClose }: UseSaveStateOptions) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const executeSave = async (
    saveAction: () => void | Promise<void>,
    successMessage: string = DEFAULT_SUCCESS_MESSAGE
  ) => {
    try {
      setIsSaving(true);
      await saveAction();
      setSaveMessage(successMessage);

      setTimeout(() => {
        setSaveMessage("");
        onClose();
      }, SAVE_MESSAGE_TIMEOUT_MS);
    } catch (error) {
      const message = getErrorMessage(error);
      logError(SAVE_HOOK_CONTEXT, error, { operation: "executeSave" });
      setSaveMessage(SAVE_ERROR_MESSAGE);
      logWarning(SAVE_HOOK_CONTEXT, "Save failed", { reason: message });
    } finally {
      setIsSaving(false);
    }
  };

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
