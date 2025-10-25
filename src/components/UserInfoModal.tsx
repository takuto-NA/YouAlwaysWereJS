/**
 * ユーザー情報モーダルコンポーネント
 * ユーザーのプロフィール情報を管理し、DynamicContextで活用
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  UserIcon,
  XMarkIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { UserInfo, DEFAULT_USER_INFO } from "../types/userInfo";
import { useSaveState } from "../hooks/useSaveState";
import SaveButton from "./SaveButton";

interface UserInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = "user_info";

function loadUserInfo(): UserInfo {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_USER_INFO, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("ユーザー情報の読み込みに失敗:", error);
  }
  return DEFAULT_USER_INFO;
}

function saveUserInfo(userInfo: UserInfo): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo));
  } catch (error) {
    console.error("ユーザー情報の保存に失敗:", error);
    throw error;
  }
}

function UserInfoModal({ isOpen, onClose }: UserInfoModalProps) {
  const [userInfo, setUserInfo] = useState<UserInfo>(loadUserInfo());
  const [originalUserInfo, setOriginalUserInfo] = useState<UserInfo>(loadUserInfo());
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { isSaving, saveMessage, executeSave, resetSaveMessage } = useSaveState({ onClose });

  const hasUnsavedChanges = useCallback(() => {
    return JSON.stringify(userInfo) !== JSON.stringify(originalUserInfo);
  }, [userInfo, originalUserInfo]);

  useEffect(() => {
    if (isOpen) {
      const loadedUserInfo = loadUserInfo();
      setUserInfo(loadedUserInfo);
      setOriginalUserInfo(loadedUserInfo);
      resetSaveMessage();
      setShowUnsavedWarning(false);
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    }

    return () => {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        if (hasUnsavedChanges() && !showUnsavedWarning) {
          setShowUnsavedWarning(true);
          return;
        }
        setShowUnsavedWarning(false);
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, hasUnsavedChanges, showUnsavedWarning, onClose]);


  const handleSave = async () => {
    await executeSave(async () => {
      saveUserInfo(userInfo);
      setOriginalUserInfo(userInfo);
    });
  };

  const handleClose = () => {
    if (hasUnsavedChanges() && !showUnsavedWarning) {
      setShowUnsavedWarning(true);
      return;
    }
    setShowUnsavedWarning(false);
    onClose();
  };

  const handleOverlayClick = () => {
    if (hasUnsavedChanges() && !showUnsavedWarning) {
      setShowUnsavedWarning(true);
      return;
    }
    handleClose();
  };

  const handleForceClose = () => {
    setUserInfo(originalUserInfo);
    setShowUnsavedWarning(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden touch-none animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-info-modal-title"
    >
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleOverlayClick}
        onTouchMove={(e) => e.preventDefault()}
        aria-hidden="true"
      />

      {/* モーダル本体 */}
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-2xl mx-4 bg-black border border-gray-700 shadow-2xl flex flex-col touch-auto animate-slideUp"
        style={{ maxHeight: "calc(100dvh - 2rem)" }}
      >
        {/* ヘッダー */}
        <div className="flex-shrink-0 bg-black border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserIcon className="w-7 h-7 text-white" aria-hidden="true" />
            <h2
              id="user-info-modal-title"
              className="text-xl font-light text-white uppercase tracking-widest"
            >
              User Info
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="text-gray-600 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black rounded p-1"
            aria-label="閉じる"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6 touch-pan-y">
          {/* 未保存の変更警告 */}
          {showUnsavedWarning && (
            <div className="bg-yellow-900/20 border border-yellow-600/50 p-4 space-y-3 animate-fadeIn">
              <div className="flex items-start gap-3">
                <XCircleIcon className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-yellow-200 text-sm font-light uppercase tracking-wider">
                    Unsaved Changes
                  </p>
                  <p className="text-yellow-300/80 text-xs mt-1">
                    You have unsaved changes. Do you want to close without saving?
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowUnsavedWarning(false)}
                  className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white transition-colors duration-200 uppercase tracking-wider text-xs focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
                >
                  Cancel
                </button>
                <button
                  onClick={handleForceClose}
                  className="px-4 py-2 bg-yellow-600 text-white hover:bg-yellow-500 transition-colors duration-200 uppercase tracking-wider text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-black"
                >
                  Close Without Saving
                </button>
              </div>
            </div>
          )}

          {/* 説明 */}
          <div className="text-xs text-gray-600">
            ここで設定した情報は、プロンプトエディタのDynamic Contextで利用できます。
            AIがあなたのことをより理解し、パーソナライズされた応答を提供します。
          </div>

          {/* 名前 */}
          <div className="space-y-3">
            <label
              htmlFor="user-name"
              className="text-white font-light uppercase tracking-wider text-sm block"
            >
              Name
            </label>
            <input
              id="user-name"
              type="text"
              value={userInfo.name}
              onChange={(e) => setUserInfo({ ...userInfo, name: e.target.value })}
              className="w-full bg-black border border-gray-700 text-white px-4 py-3 text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white transition-all duration-200"
              placeholder="例: 山田太郎"
            />
          </div>

          {/* カスタムノート */}
          <div className="space-y-3">
            <label
              htmlFor="user-notes"
              className="text-white font-light uppercase tracking-wider text-sm block"
            >
              Additional Notes
            </label>
            <textarea
              id="user-notes"
              value={userInfo.customNotes}
              onChange={(e) => setUserInfo({ ...userInfo, customNotes: e.target.value })}
              className="w-full bg-black border border-gray-700 text-white px-4 py-3 text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white transition-all duration-200 resize-none"
              rows={8}
              placeholder="AIに知っておいてほしい追加情報を自由に記入してください（年齢、職業、趣味、興味、希望するトーンなど）"
            />
          </div>
        </div>

        {/* フッター */}
        <div className="flex-shrink-0 bg-black border-t border-gray-700 px-6 py-4">
          <SaveButton onClick={handleSave} isSaving={isSaving} saveMessage={saveMessage} />
        </div>
      </div>
    </div>
  );
}

export default UserInfoModal;
