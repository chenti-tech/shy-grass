import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  User,
  Lock,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Calendar,
  Search,
  LogOut,
  ChevronDown,
  ChevronUp,
  Trash2,
  Eye,
  Download,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Folder,
  FolderOpen,
  Mail,
  Clock,
  AlertTriangle,
  Settings,
  Plus,
  Loader,
  RotateCw,
  RotateCcw,
  Sun,
  FileSpreadsheet,
  Bell,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Save,
  Filter,
  Megaphone,
  BarChart3,
  Maximize2,
  Tag,
  X,
  Printer,
  Link as LinkIcon,
  Siren,
  BookOpen,
  Info,
  Image as ImageIcon,
  Database,
  CheckSquare,
  Square,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  setDoc,
} from "firebase/firestore";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

// --- Firebase 初始化 ---

let firebaseConfig;
let appId = "chenti-essay-system-v1";

// 2. 若無預覽設定 (CodeSandbox / 本地開發)，請在此填入您的設定
if (!firebaseConfig) {
  firebaseConfig = {
    apiKey: "AIzaSyDcycrPjLKCXE_rLl31pd6Q3JpsT33_KYY",
    authDomain: "writing-1bdb1.firebaseapp.com",
    projectId: "writing-1bdb1",
    storageBucket: "writing-1bdb1.firebasestorage.app",
    messagingSenderId: "969535016592",
    appId: "1:969535016592:web:5e72bf63c27540e6799215",
    measurementId: "G-0KHWTXE8JN",
  };
}

// 初始化 Firebase 實例
let app, auth, db;
try {
  // 簡單檢查是否有設定
  if (
    firebaseConfig &&
    (firebaseConfig.apiKey || typeof __firebase_config !== "undefined")
  ) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } else {
    console.warn("⚠️ 尚未填入 Firebase 設定");
  }
} catch (e) {
  console.error("Firebase Init Error:", e);
}

// --- 常數設定 ---

const COURSE_SETTINGS = {
  maxEssays: 20,
  courseDurationDays: 200,
  maxScore: 25, // 系統全域最大值 (Chart用)
  dbSizeLimitBytes: 1000000000, // 1GB Firebase 免費額度
};

// 作文主題分類
const ESSAY_TOPICS = ["知性題目", "感性題目"];

// --- 工具函數 ---

// 取得該題目的滿分標準
const getMaxScore = (topic) => {
  if (topic === "知性題目") return 21;
  if (topic === "感性題目") return 25;
  return 25; // 預設
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const formatDateTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleString("zh-TW", { hour12: false });
};

const calculateRemainingDays = (expiryDate) => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

const isSameDay = (d1, d2) => {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// 圖片壓縮並轉 Base64 (畫質優化版)
const compressImageToBase64 = (file, maxWidth = 1024, quality = 0.6) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const base64 = canvas.toDataURL("image/jpeg", quality);
        resolve(base64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const estimateDbUsage = (users, submissions) => {
  const usersSize = JSON.stringify(users).length;
  const subsSize = JSON.stringify(submissions).length;
  return usersSize + subsSize;
};

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

// --- 通用元件 ---

// 確認對話框元件 (取代 window.confirm)
const ConfirmModal = ({ isOpen, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black bg-opacity-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-scale-in">
        <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          <AlertTriangle className="text-yellow-500" size={24} />
          請確認
        </h3>
        <p className="text-gray-600 mb-6 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition font-medium"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow transition font-medium"
          >
            確認
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 主要元件 ---

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("loading");
  const [currentProfile, setCurrentProfile] = useState(null);

  const [allUsers, setAllUsers] = useState([]);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [announcement, setAnnouncement] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (!auth) return;

    const initAuth = async () => {
      if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        if (view === "loading") setView("login");
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const usersQuery = query(
      collection(db, "artifacts", appId, "public", "data", "users")
    );
    const unsubUsers = onSnapshot(
      usersQuery,
      (snapshot) => {
        const usersList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAllUsers(usersList);

        if (currentProfile) {
          const updatedMe = usersList.find((u) => u.id === currentProfile.id);
          if (updatedMe) setCurrentProfile(updatedMe);
        }
      },
      (error) => console.error("Users sync error:", error)
    );

    const subsQuery = query(
      collection(db, "artifacts", appId, "public", "data", "submissions")
    );
    const unsubSubs = onSnapshot(
      subsQuery,
      (snapshot) => {
        const subsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        subsList.sort((a, b) => new Date(b.date) - new Date(a.date));
        setAllSubmissions(subsList);
      },
      (error) => console.error("Submissions sync error:", error)
    );

    const announcementDocRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "system_announcement",
      "main"
    );
    const unsubAnnounce = onSnapshot(
      announcementDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setAnnouncement(docSnap.data());
        } else {
          setAnnouncement(null);
        }
      },
      (error) => console.error("Announcement sync error:", error)
    );

    return () => {
      unsubUsers();
      unsubSubs();
      unsubAnnounce();
    };
  }, [user, currentProfile?.id]);

  const showNotification = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogin = async (role, credentials, action = "login") => {
    if (role === "admin") {
      try {
        await signInWithEmailAndPassword(
          auth,
          credentials.username,
          credentials.password
        );
        setCurrentProfile({ role: "admin", name: "管理員" });
        setView("admin");
        showNotification("管理員登入成功", "success");
      } catch (error) {
        console.error("Login Error:", error);
        let errorMsg = "登入失敗";
        if (error.code === "auth/invalid-email") errorMsg = "Email 格式錯誤";
        if (error.code === "auth/user-not-found") errorMsg = "找不到此使用者";
        if (error.code === "auth/wrong-password") errorMsg = "密碼錯誤";
        if (error.code === "auth/too-many-requests")
          errorMsg = "登入嘗試次數過多，請稍後再試";
        showNotification(errorMsg, "error");
      }
    } else {
      const inputPhone = (credentials.phone || "").trim();
      const inputName = (credentials.name || "").trim();

      if (!inputPhone || !inputName) {
        showNotification("請輸入完整的姓名與手機號碼", "error");
        return;
      }

      // 手機格式驗證 (新增)
      const phoneRegex = /^09\d{8}$/;
      if (!phoneRegex.test(inputPhone)) {
        showNotification(
          "手機號碼格式錯誤，請輸入 09 開頭的 10 碼數字",
          "error"
        );
        return;
      }

      const foundUser = allUsers.find(
        (u) => (u.phone || "").trim() === inputPhone
      );

      if (action === "login") {
        // --- 登入邏輯 ---
        if (foundUser) {
          if ((foundUser.name || "").trim() === inputName) {
            try {
              await updateDoc(
                doc(
                  db,
                  "artifacts",
                  appId,
                  "public",
                  "data",
                  "users",
                  foundUser.id
                ),
                {
                  lastLoginAt: new Date().toISOString(),
                }
              );
            } catch (e) {
              console.error("Update login time error", e);
            }

            setCurrentProfile({ ...foundUser, role: "student" });
            setView("student");
            showNotification("登入成功", "success");
          } else {
            showNotification("姓名與手機號碼不符，請檢查", "error");
          }
        } else {
          showNotification("此手機號碼尚未註冊，請點選「新用戶註冊」", "error");
        }
      } else if (action === "register") {
        // --- 註冊邏輯 ---
        if (foundUser) {
          showNotification("此手機號碼已註冊，請直接點選「會員登入」", "info");
        } else {
          // 檢查姓名是否被占用 (防止同名混淆，確保一對一)
          const userByName = allUsers.find(
            (u) => (u.name || "").trim() === inputName
          );
          if (userByName) {
            showNotification("此姓名已被其他手機註冊，請聯繫管理員", "error");
          } else {
            try {
              const newUser = {
                name: inputName,
                phone: inputPhone,
                startDate: new Date().toISOString(),
                expiryDate: new Date(
                  Date.now() +
                    COURSE_SETTINGS.courseDurationDays * 24 * 60 * 60 * 1000
                ).toISOString(),
                isManualLocked: false,
                role: "student",
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
                tags: [],
              };

              const docRef = await addDoc(
                collection(db, "artifacts", appId, "public", "data", "users"),
                newUser
              );
              const userWithId = { id: docRef.id, ...newUser };

              setCurrentProfile(userWithId);
              setView("student");
              showNotification("註冊成功！歡迎加入", "success");
            } catch (err) {
              console.error(err);
              showNotification("註冊失敗，請稍後再試", "error");
            }
          }
        }
      }
    }
  };

  const handleLogout = () => {
    setCurrentProfile(null);
    setView("login");
  };

  if (!auth) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col p-4 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          尚未設定 Firebase
        </h1>
        <p className="text-gray-700 mb-4">
          如果您正在預覽環境，請稍候重整。
          <br />
          如果這是 Local 或 CodeSandbox，請填入 Config。
        </p>
      </div>
    );
  }

  if (view === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="animate-spin h-10 w-10 text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-500">正在連線至雲端系統...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {notification && (
        <div
          className={`fixed top-4 right-4 z-[90] px-6 py-3 rounded shadow-lg text-white ${
            notification.type === "error"
              ? "bg-red-500"
              : notification.type === "success"
              ? "bg-green-500"
              : "bg-blue-500"
          } transition-all duration-300 animate-fade-in-down`}
        >
          {notification.msg}
        </div>
      )}

      {view === "login" && (
        <LoginScreen onLogin={handleLogin} announcement={announcement} />
      )}

      {view === "student" && currentProfile && (
        <StudentDashboard
          user={currentProfile}
          submissions={allSubmissions}
          announcement={announcement}
          onLogout={handleLogout}
          showNotification={showNotification}
        />
      )}

      {view === "admin" && currentProfile && (
        <AdminDashboard
          users={allUsers}
          submissions={allSubmissions}
          announcement={announcement}
          onLogout={handleLogout}
          showNotification={showNotification}
        />
      )}
    </div>
  );
}

// --- 登入畫面 ---

function LoginScreen({ onLogin, announcement }) {
  const [role, setRole] = useState("student");
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    username: "",
    password: "",
  });
  const [studentAction, setStudentAction] = useState("login");

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(role, formData, studentAction);
  };

  const showAnnouncement =
    announcement &&
    announcement.visible &&
    announcement.content &&
    (!announcement.targetTags || announcement.targetTags.length === 0);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-100 to-blue-50 p-4">
      {showAnnouncement && (
        <div className="absolute top-0 left-0 w-full bg-yellow-100 border-b border-yellow-200 p-3 shadow-sm z-10 animate-fade-in-down">
          <div className="max-w-md mx-auto flex items-start gap-3">
            <Megaphone
              size={20}
              className="text-yellow-600 flex-shrink-0 mt-0.5"
            />
            <div className="flex-1">
              <p className="text-yellow-800 text-sm font-medium whitespace-pre-wrap">
                {announcement.content}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-indigo-50 mt-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-900 mb-2">
            陳蒂國文補習班
          </h1>
          <p className="text-gray-500">雲端作文繳交系統</p>
        </div>

        <div className="flex mb-6 bg-gray-100 p-1 rounded-lg">
          <button
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              role === "student"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setRole("student")}
          >
            學員登入/註冊
          </button>
          <button
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              role === "admin"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setRole("admin")}
          >
            老師/管理員登入
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {role === "student" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  真實姓名
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  placeholder="請輸入姓名"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  家長手機 (作為密碼)
                </label>
                <input
                  type="tel"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  placeholder="0912345678"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  onClick={() => setStudentAction("register")}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-lg shadow transition duration-200"
                >
                  新用戶註冊
                </button>
                <button
                  type="submit"
                  onClick={() => setStudentAction("login")}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow transition duration-200"
                >
                  會員登入
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  管理員 Email
                </label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  密碼
                </label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </div>
              <div className="mt-6">
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow transition duration-200"
                >
                  登入系統
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

// --- 學生後台 ---

// 登入後提示 Modal
const LoginNoticeModal = ({ onClose }) => (
  <div className="fixed inset-0 z-[60] bg-black bg-opacity-70 flex items-center justify-center p-4 animate-fade-in-up">
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
      <div className="bg-indigo-600 p-4 text-white text-center">
        <h3 className="text-xl font-bold flex items-center justify-center gap-2">
          <Info size={24} /> 繳交注意事項
        </h3>
      </div>
      <div className="p-6 space-y-4">
        <div className="space-y-3 text-gray-700">
          <div className="flex items-start gap-3">
            <CheckCircle
              className="text-green-500 flex-shrink-0 mt-0.5"
              size={20}
            />
            <p>
              <strong>用黑原子筆</strong>：字跡清晰，勿用鉛筆。
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle
              className="text-green-500 flex-shrink-0 mt-0.5"
              size={20}
            />
            <p>
              <strong>標示篇名</strong>：第一行空四格寫題目。
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle
              className="text-green-500 flex-shrink-0 mt-0.5"
              size={20}
            />
            <p>
              <strong>光線充足</strong>：在亮處拍攝，無陰影。
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle
              className="text-green-500 flex-shrink-0 mt-0.5"
              size={20}
            />
            <p>
              <strong>水平拍攝</strong>：鏡頭對準正上方，不歪斜。
            </p>
          </div>
        </div>

        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-sm text-red-700 mt-4">
          <p className="font-bold flex items-center gap-1 mb-1">
            <AlertTriangle size={16} /> 特別注意
          </p>
          為符合學測規定，請同學以黑筆書寫，否則不予評分、批閱。
        </div>

        <button
          onClick={onClose}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow transition mt-2"
        >
          我已了解，開始繳交
        </button>
      </div>
    </div>
  </div>
);

// 放大圖片預覽 (Lightbox)
const ImageLightbox = ({ src, onClose }) => (
  <div
    className="fixed inset-0 z-[70] bg-black bg-opacity-90 flex items-center justify-center cursor-pointer"
    onClick={onClose}
  >
    <img
      src={src}
      className="max-w-[90vw] max-h-[90vh] object-contain shadow-2xl"
      alt="Full size guide"
    />
  </div>
);

const ScoreChart = ({ scores }) => {
  if (scores.length === 0) return null;

  const height = 100;
  const width = 100;
  const maxScore = 25;

  const points = scores
    .map((score, index) => {
      const x =
        scores.length === 1 ? 50 : (index / (scores.length - 1)) * width;
      const y = height - (score / maxScore) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="w-full h-32 mt-4 bg-indigo-50 rounded-lg p-4 relative border border-indigo-100">
      <h4 className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1">
        <TrendingUp size={14} /> 成績走勢
      </h4>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-20 overflow-visible"
        preserveAspectRatio="none"
      >
        <line x1="0" y1="0" x2="100" y2="0" stroke="#e0e7ff" strokeWidth="1" />
        <line
          x1="0"
          y1="50"
          x2="100"
          y2="50"
          stroke="#e0e7ff"
          strokeWidth="1"
        />
        <line
          x1="0"
          y1="100"
          x2="100"
          y2="100"
          stroke="#e0e7ff"
          strokeWidth="1"
        />

        {scores.length > 1 && (
          <polyline
            fill="none"
            stroke="#4f46e5"
            strokeWidth="3"
            points={points}
            vectorEffect="non-scaling-stroke"
          />
        )}

        {scores.map((score, index) => {
          const x =
            scores.length === 1 ? 50 : (index / (scores.length - 1)) * width;
          const y = height - (score / maxScore) * height;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="3"
              fill="#4f46e5"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </div>
  );
};

const SubmissionViewerModal = ({ submission, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-[70] bg-black bg-opacity-90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full bg-white rounded-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <h3 className="font-bold">
            繳交檢視: {formatDateTime(submission.date)}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-gray-100 flex justify-center">
          <div className="space-y-4 w-full max-w-2xl">
            {submission.imageUrls &&
              submission.imageUrls.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`page-${idx}`}
                  className="w-full h-auto rounded shadow-sm border"
                />
              ))}
            {!submission.imageUrls && submission.imageUrl && (
              <img
                src={submission.imageUrl}
                alt="submission"
                className="w-full h-auto rounded shadow-sm border"
              />
            )}
          </div>
        </div>
        {submission.status === "graded" && (
          <div className="p-4 bg-white border-t">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-gray-700">老師評語</span>
              <span className="text-xl font-bold text-indigo-600">
                {submission.score}分{" "}
                <span className="text-sm text-gray-500">
                  / {getMaxScore(submission.topic)}分
                </span>
              </span>
            </div>
            <p className="text-gray-600 text-sm whitespace-pre-wrap">
              {submission.comment}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

function StudentDashboard({
  user,
  submissions,
  announcement,
  onLogout,
  showNotification,
}) {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [viewSubmission, setViewSubmission] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(ESSAY_TOPICS[0]);
  const [showLoginNotice, setShowLoginNotice] = useState(true);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    message: "",
    onConfirm: null,
  });

  const mySubmissions = useMemo(
    () => submissions.filter((s) => s.studentId === user.id),
    [submissions, user.id]
  );

  const gradedSubmissions = useMemo(
    () => mySubmissions.filter((s) => s.status === "graded"),
    [mySubmissions]
  );

  const scoreTrend = useMemo(
    () =>
      [...gradedSubmissions]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((s) => s.score),
    [gradedSubmissions]
  );

  const remainingDays = calculateRemainingDays(user.expiryDate);
  const isExpiredAccount = remainingDays <= 0;

  const submittedToday = mySubmissions.some((s) =>
    isSameDay(s.date, new Date())
  );
  const countSubmitted = mySubmissions.length;
  const isLimitReached = countSubmitted >= COURSE_SETTINGS.maxEssays;

  const canSubmit =
    !isExpiredAccount &&
    !user.isManualLocked &&
    !submittedToday &&
    !isLimitReached;

  const remainingDaysCardStyle = useMemo(() => {
    if (remainingDays <= 7) return "from-red-500 to-red-600";
    if (remainingDays <= 30) return "from-yellow-500 to-orange-500";
    return "from-green-500 to-green-600";
  }, [remainingDays]);

  const showAnnouncement = useMemo(() => {
    if (!announcement || !announcement.visible || !announcement.content)
      return false;
    if (!announcement.targetTags || announcement.targetTags.length === 0)
      return true;
    const userTags = user.tags || [];
    return announcement.targetTags.some((tag) => userTags.includes(tag));
  }, [announcement, user.tags]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    processFiles(selectedFiles);
  };

  const processFiles = (selectedFiles) => {
    const validFiles = selectedFiles.filter((f) => f.type.startsWith("image/"));
    if (validFiles.length !== selectedFiles.length) {
      showNotification("僅支援圖片格式檔案", "error");
    }

    const totalFiles = [...files, ...validFiles].slice(0, 3);
    if (files.length + validFiles.length > 3) {
      showNotification("單次最多上傳 3 張圖片", "info");
    }

    setFiles(totalFiles);

    const newPreviews = [];
    let processed = 0;

    if (totalFiles.length === 0) {
      setPreviews([]);
      return;
    }

    totalFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result);
        processed++;
        if (processed === totalFiles.length) {
          setPreviews([...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);

    if (newFiles.length === 0) {
      setPreviews([]);
      return;
    }

    const newPreviews = [];
    let processed = 0;
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result);
        processed++;
        if (processed === newFiles.length) setPreviews([...newPreviews]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const selectedFiles = Array.from(e.dataTransfer.files);
    processFiles(selectedFiles);
  };

  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData.items;
      const pastedFiles = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          pastedFiles.push(items[i].getAsFile());
        }
      }
      if (pastedFiles.length > 0) processFiles(pastedFiles);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [files]);

  const handleSubmit = async () => {
    if (files.length === 0 || !canSubmit) return;
    setIsUploading(true);

    try {
      const compressedImages = await Promise.all(
        files.map((file) => compressImageToBase64(file))
      );

      for (let img of compressedImages) {
        if (img.length > 1500000) {
          throw new Error("其中一張圖片過大，請重新拍攝或壓縮後上傳");
        }
      }

      const newSubmission = {
        studentId: user.id,
        studentName: user.name,
        date: new Date().toISOString(),
        imageUrls: compressedImages,
        imageUrl: compressedImages[0],
        storagePath: null,
        status: "pending",
        score: null,
        comment: "",
        topic: selectedTopic,
      };

      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "submissions"),
        newSubmission
      );

      setFiles([]);
      setPreviews([]);
      showNotification("作文繳交成功！", "success");
    } catch (error) {
      console.error("Upload error:", error);
      showNotification(error.message || "上傳失敗，請檢查權限或網路", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetract = (sub) => {
    setConfirmConfig({
      isOpen: true,
      message: "確定要收回這份作業嗎？收回後可以重新上傳。",
      onConfirm: async () => {
        try {
          await deleteDoc(
            doc(db, "artifacts", appId, "public", "data", "submissions", sub.id)
          );
          showNotification("已收回作業", "info");
        } catch (err) {
          console.error(err);
          showNotification("收回失敗", "error");
        }
        setConfirmConfig({ ...confirmConfig, isOpen: false });
      },
    });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      {showLoginNotice && (
        <LoginNoticeModal onClose={() => setShowLoginNotice(false)} />
      )}

      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
      />

      <header className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            歡迎回來，{user.name} 同學
          </h1>
          <p className="text-gray-500 mt-1">
            課程期限: {formatDate(user.expiryDate)}
          </p>
          <div className="flex gap-2 mt-2">
            {user.tags &&
              user.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full font-medium"
                >
                  #{tag}
                </span>
              ))}
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-gray-600 hover:text-red-500 px-4 py-2 rounded-lg hover:bg-red-50 transition border border-gray-200 bg-white"
          >
            <LogOut size={18} /> 登出
          </button>
        </div>
      </header>

      {/* 班級公告欄 */}
      {showAnnouncement && (
        <div className="mb-8 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded shadow-sm flex items-start gap-4 animate-fade-in-down">
          <div className="bg-yellow-100 p-2 rounded-full text-yellow-600 flex-shrink-0">
            <Megaphone size={24} />
          </div>
          <div>
            <h3 className="font-bold text-yellow-800 text-lg flex items-center gap-2">
              班級公告
              {announcement.targetTags &&
                announcement.targetTags.length > 0 && (
                  <span className="text-xs font-normal bg-yellow-200 text-yellow-700 px-2 py-0.5 rounded">
                    指定給: {announcement.targetTags.join(", ")}
                  </span>
                )}
            </h3>
            <p className="text-yellow-700 mt-1 whitespace-pre-wrap">
              {String(announcement.content)}
            </p>
            <p className="text-yellow-600 text-xs mt-2 text-right">
              發布時間: {formatDateTime(announcement.updatedAt)}
            </p>
          </div>
        </div>
      )}

      {gradedSubmissions.length > 0 && (
        <div className="mb-8 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-4 shadow-sm">
          <div className="bg-green-100 p-2 rounded-full text-green-600">
            <Bell size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-green-800 text-lg">
              您有 {gradedSubmissions.length} 篇作文已完成批改！
            </h3>
            <p className="text-green-700 text-sm mt-1">
              最新的批改：{formatDate(gradedSubmissions[0].date)} 的作業， 得分{" "}
              <span className="font-bold text-lg">
                {gradedSubmissions[0].score}
              </span>{" "}
              分。
            </p>
            <ScoreChart scores={scoreTrend} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div
          className={`bg-gradient-to-br ${remainingDaysCardStyle} rounded-xl p-6 text-white shadow-lg transition-colors duration-500`}
        >
          <div className="flex items-center gap-3 mb-2">
            <Clock className="opacity-80" />
            <h3 className="font-semibold text-lg">剩餘課程天數</h3>
          </div>
          <p className="text-4xl font-bold">
            {remainingDays}{" "}
            <span className="text-lg font-normal opacity-80">天</span>
          </p>
          {isExpiredAccount && (
            <p className="mt-2 bg-white/20 inline-block px-2 py-1 rounded text-xs">
              課程已到期
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2 text-indigo-600">
            <FileText />
            <h3 className="font-semibold text-lg">繳交狀況</h3>
          </div>
          <p className="text-4xl font-bold text-gray-800">
            {countSubmitted}{" "}
            <span className="text-lg font-normal text-gray-400">
              / {COURSE_SETTINGS.maxEssays}
            </span>
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-3">
            <div
              className="bg-indigo-600 h-2.5 rounded-full"
              style={{
                width: `${Math.min(
                  100,
                  (countSubmitted / COURSE_SETTINGS.maxEssays) * 100
                )}%`,
              }}
            ></div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2 text-green-600">
            <CheckCircle />
            <h3 className="font-semibold text-lg">本日狀態</h3>
          </div>
          <p className="text-lg font-medium text-gray-700">
            {submittedToday ? "今日已完成繳交" : "今日尚未繳交"}
          </p>
          {user.isManualLocked && (
            <p className="text-red-500 text-sm mt-1">已被老師暫停繳交權限</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 上傳區塊 - 支援多圖 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-700 flex items-center gap-2">
                <Upload size={18} /> 上傳新作文
              </h2>
            </div>
            <div className="p-6">
              {!canSubmit ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <XCircle size={40} className="mx-auto mb-2 text-gray-400" />
                  <p>目前無法繳交</p>
                  <p className="text-xs mt-1">
                    (可能原因：今日已交、額度已滿、課程過期或被停權)
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 作文主題選擇 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                      <BookOpen size={16} className="text-indigo-600" />{" "}
                      選擇作文主題
                    </label>
                    <select
                      value={selectedTopic}
                      onChange={(e) => setSelectedTopic(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {ESSAY_TOPICS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label
                    className={`block w-full cursor-pointer group relative ${
                      isDragging ? "scale-105" : ""
                    } transition-transform`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                    />
                    <div
                      className={`w-full h-48 border-2 border-dashed ${
                        isDragging
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-indigo-200 bg-indigo-50"
                      } rounded-xl flex flex-col items-center justify-center group-hover:bg-indigo-100 transition text-indigo-400`}
                    >
                      <Upload
                        size={32}
                        className={`mb-2 ${isDragging ? "animate-bounce" : ""}`}
                      />
                      <span className="text-sm font-medium">
                        {files.length > 0
                          ? `已選擇 ${files.length} 張圖片`
                          : "點擊 / 拖曳圖片 (最多3張)"}
                      </span>
                    </div>
                  </label>

                  {/* 預覽區 */}
                  {previews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {previews.map((src, idx) => (
                        <div
                          key={idx}
                          className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group"
                        >
                          <img
                            src={src}
                            className="w-full h-full object-cover"
                            alt="preview"
                          />
                          <button
                            onClick={() => removeFile(idx)}
                            className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-red-500 transition"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={files.length === 0 || isUploading}
                    className={`w-full py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                      files.length > 0 && !isUploading
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {isUploading ? (
                      <Loader className="animate-spin" size={20} />
                    ) : (
                      <CheckCircle size={20} />
                    )}
                    {isUploading ? "上傳中..." : "確認繳交"}
                  </button>
                </div>
              )}

              {/* 上傳注意事項區塊 */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
                  <Info size={16} className="text-indigo-500" /> 上傳注意事項
                  (點圖可放大)
                </h4>
                <div className="text-xs text-gray-600 space-y-2 mb-4">
                  <p>1. 請確保光線充足，避免陰影遮擋文字。</p>
                  <p>2. 鏡頭請與紙面保持水平，避免變形。</p>
                  <p>3. 請使用黑筆書寫，字跡需清晰可辨。</p>
                </div>
                {/* 圖片預覽區 (可點擊放大) */}
                <div
                  className="rounded-lg overflow-hidden border border-gray-200 cursor-zoom-in group relative"
                  onClick={() =>
                    setLightboxImage(
                      "https://www.chenti-chinese.com/wp-content/uploads/2025/12/Gemini_Generated_Image_h9s8vxh9s8vxh9s8-e1766481893338.png"
                    )
                  }
                >
                  <img
                    src="https://www.chenti-chinese.com/wp-content/uploads/2025/12/Gemini_Generated_Image_h9s8vxh9s8vxh9s8-e1766481893338.png"
                    alt="上傳範例"
                    className="w-full h-auto min-h-[150px] object-cover group-hover:opacity-90 transition"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
                    <Maximize2
                      className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md"
                      size={24}
                    />
                  </div>
                  <div className="bg-gray-50 p-2 text-center text-xs text-gray-400">
                    上傳注意事項
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[500px]">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-700 flex items-center gap-2">
                <FolderOpen size={18} /> 我的繳交紀錄
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {mySubmissions.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  尚無繳交紀錄
                </div>
              ) : (
                mySubmissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-4 hover:bg-gray-50 transition flex flex-col sm:flex-row gap-4"
                  >
                    <div
                      className="w-full sm:w-32 h-32 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 cursor-zoom-in relative group"
                      onClick={() => setViewSubmission(sub)}
                    >
                      {/* 顯示第一張圖 */}
                      <img
                        src={sub.imageUrls ? sub.imageUrls[0] : sub.imageUrl}
                        alt="essay"
                        className="w-full h-full object-cover"
                      />

                      {/* 多圖提示 */}
                      {sub.imageUrls && sub.imageUrls.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                          <ImageIcon size={10} /> +{sub.imageUrls.length - 1}
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                        <Maximize2
                          className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md"
                          size={20}
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-gray-800 text-lg mb-1">
                            {formatDateTime(sub.date)}
                          </p>
                          {sub.topic && (
                            <span className="inline-block bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded border border-blue-100 mb-2 mr-2">
                              {sub.topic}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              sub.status === "graded"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {sub.status === "graded" ? "已批改" : "等待批改"}
                          </span>
                        </div>
                        {sub.status !== "graded" && !isExpiredAccount && (
                          <button
                            onClick={() => handleRetract(sub)}
                            className="text-red-500 hover:text-red-700 text-sm border border-red-200 hover:bg-red-50 px-3 py-1 rounded transition"
                          >
                            收回重交
                          </button>
                        )}
                      </div>

                      {sub.status === "graded" && (
                        <div className="mt-3 bg-green-50 p-3 rounded-lg border border-green-100">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-green-800">
                              老師評語：
                            </span>
                            <span className="font-bold text-xl text-indigo-600">
                              {sub.score}{" "}
                              <span className="text-sm text-gray-500">
                                / {getMaxScore(sub.topic)}分
                              </span>
                            </span>
                          </div>
                          <p className="text-gray-700 text-sm whitespace-pre-wrap">
                            {sub.comment}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {viewSubmission && (
        <SubmissionViewerModal
          submission={viewSubmission}
          onClose={() => setViewSubmission(null)}
        />
      )}
    </div>
  );
}

// --- 管理員後台 ---

function AdminDashboard({
  users,
  submissions,
  announcement,
  onLogout,
  showNotification,
}) {
  const [activeTab, setActiveTab] = useState("folders");
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: "remainingDays",
    direction: "asc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [filterTag, setFilterTag] = useState("all");
  const [tagInput, setTagInput] = useState("");

  // 批量操作狀態
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());

  // Modal 狀態
  const [gradingItem, setGradingItem] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementText, setAnnouncementText] = useState(
    announcement?.content || ""
  );
  const [announcementTargetTags, setAnnouncementTargetTags] = useState(
    announcement?.targetTags || []
  );
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    message: "",
    onConfirm: null,
  });

  const [isExporting, setIsExporting] = useState(false);

  const [gradingData, setGradingData] = useState({ score: "", comment: "" });
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageBrightness, setImageBrightness] = useState(100);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  // 新增：學員編輯狀態
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // 鍵盤事件監聽
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gradingItem) return;

      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          saveGrading(true);
        }
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          setCurrentImgIndex((prev) => Math.max(0, prev - 1));
          break;
        case "ArrowRight":
          const maxIdx = (gradingItem.imageUrls?.length || 1) - 1;
          setCurrentImgIndex((prev) => Math.min(maxIdx, prev + 1));
          break;
        case "PageUp":
          navigateSubmission("prev");
          break;
        case "PageDown":
          navigateSubmission("next");
          break;
        case "[":
          setImageRotation((prev) => prev - 90);
          break;
        case "]":
          setImageRotation((prev) => prev + 90);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gradingItem]);

  useEffect(() => {
    if (announcement) {
      setAnnouncementText(announcement.content);
      setAnnouncementTargetTags(announcement.targetTags || []);
    }
  }, [announcement]);

  const availableTags = useMemo(() => {
    const tags = new Set();
    users.forEach((u) => {
      if (u.tags && Array.isArray(u.tags)) {
        u.tags.forEach((t) => tags.add(t));
      }
    });
    return Array.from(tags).sort();
  }, [users]);

  const riskAnalysis = useMemo(() => {
    const regressionRisks = [];
    const inactivityRisks = [];

    users.forEach((u) => {
      const userSubs = submissions.filter((s) => s.studentId === u.id);

      const lastSubDate =
        userSubs.length > 0
          ? new Date(Math.max(...userSubs.map((s) => new Date(s.date))))
          : new Date(u.startDate);

      const lastLoginDate = u.lastLoginAt
        ? new Date(u.lastLoginAt)
        : new Date(u.startDate);
      const lastActivity = new Date(
        Math.max(lastSubDate.getTime(), lastLoginDate.getTime())
      );
      const daysInactive = Math.floor(
        (new Date() - lastActivity) / (1000 * 60 * 60 * 24)
      );

      if (daysInactive > 14) {
        inactivityRisks.push({
          user: u,
          days: daysInactive,
          lastActive: lastActivity,
        });
      }

      const gradedSubs = userSubs
        .filter((s) => s.status === "graded")
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      if (gradedSubs.length >= 3) {
        if (
          gradedSubs[0].score < gradedSubs[1].score &&
          gradedSubs[1].score < gradedSubs[2].score
        ) {
          regressionRisks.push({
            user: u,
            scores: [
              gradedSubs[2].score,
              gradedSubs[1].score,
              gradedSubs[0].score,
            ],
          });
        }
      }
    });

    return { regressionRisks, inactivityRisks };
  }, [users, submissions]);

  const totalRisks =
    riskAnalysis.regressionRisks.length + riskAnalysis.inactivityRisks.length;

  const dbUsage = useMemo(
    () => estimateDbUsage(users, submissions),
    [users, submissions]
  );
  const usagePercentage = Math.min(
    100,
    (dbUsage / COURSE_SETTINGS.dbSizeLimitBytes) * 100
  );

  const submissionsByMonth = useMemo(() => {
    const groups = {};
    submissions.forEach((sub) => {
      const date = new Date(sub.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(sub);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [submissions]);

  const monthAnalytics = useMemo(() => {
    if (!selectedMonth || activeTab !== "folders") return null;

    const allSubsInMonth =
      submissionsByMonth.find((g) => g[0] === selectedMonth)?.[1] || [];
    const gradedSubs = allSubsInMonth.filter(
      (s) => s.status === "graded" && typeof s.score === "number"
    );

    if (gradedSubs.length === 0) return null;

    const scores = gradedSubs.map((s) => s.score);
    const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const max = Math.max(...scores);

    const topicStats = {};
    ESSAY_TOPICS.forEach((topic) => {
      const topicSubs = gradedSubs.filter((s) => s.topic === topic);
      if (topicSubs.length > 0) {
        const topicAvg = (
          topicSubs.reduce((a, b) => a + b.score, 0) / topicSubs.length
        ).toFixed(1);
        topicStats[topic] = { avg: topicAvg, count: topicSubs.length };
      } else {
        topicStats[topic] = { avg: "-", count: 0 };
      }
    });

    const dist = {
      levelAp: 0, // A+
      levelA: 0, // A
      levelBp: 0, // B+
      levelB: 0, // B
      levelCp: 0, // C+
      levelC: 0, // C
    };

    gradedSubs.forEach((s) => {
      const sc = s.score;
      if (s.topic === "知性題目") {
        if (sc >= 19) dist.levelAp++;
        else if (sc >= 15) dist.levelA++;
        else if (sc >= 12) dist.levelBp++;
        else if (sc >= 8) dist.levelB++;
        else if (sc >= 5) dist.levelCp++;
        else dist.levelC++;
      } else {
        // 預設為感性題目 (或無分類時)
        if (sc >= 22) dist.levelAp++;
        else if (sc >= 18) dist.levelA++;
        else if (sc >= 14) dist.levelBp++;
        else if (sc >= 10) dist.levelB++;
        else if (sc >= 6) dist.levelCp++;
        else dist.levelC++;
      }
    });

    return { avg, max, total: gradedSubs.length, topicStats, dist };
  }, [selectedMonth, submissionsByMonth, activeTab]);

  const currentViewSubmissions = useMemo(() => {
    if (activeTab === "folders" && selectedMonth) {
      let subs =
        submissionsByMonth.find((g) => g[0] === selectedMonth)?.[1] || [];

      if (filterStatus === "pending") {
        subs = subs.filter((s) => s.status === "pending");
      } else if (filterStatus === "graded") {
        subs = subs.filter((s) => s.status === "graded");
      }

      if (filterTag !== "all") {
        subs = subs.filter((s) => {
          const student = users.find((u) => u.id === s.studentId);
          return student && student.tags && student.tags.includes(filterTag);
        });
      }

      return subs;
    }
    return [];
  }, [
    activeTab,
    selectedMonth,
    submissionsByMonth,
    filterStatus,
    filterTag,
    users,
  ]);

  const sortedUsers = useMemo(() => {
    let sortableUsers = [...users];

    if (searchTerm) {
      sortableUsers = sortableUsers.filter(
        (u) =>
          (u.name && u.name.includes(searchTerm)) ||
          (u.phone && u.phone.includes(searchTerm))
      );
    }

    if (filterTag !== "all") {
      sortableUsers = sortableUsers.filter(
        (u) => u.tags && u.tags.includes(filterTag)
      );
    }

    if (sortConfig.key === "remainingDays") {
      sortableUsers.sort((a, b) => {
        const daysA = calculateRemainingDays(a.expiryDate);
        const daysB = calculateRemainingDays(b.expiryDate);
        return sortConfig.direction === "asc" ? daysA - daysB : daysB - daysA;
      });
    }
    return sortableUsers;
  }, [users, sortConfig, searchTerm, filterTag]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const updateUser = async (userId, data) => {
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "users", userId),
        data
      );

      if (editingUser && editingUser.id === userId) {
        setEditingUser((prev) => ({ ...prev, ...data }));
      }
      showNotification("資料已更新", "success");
    } catch (err) {
      console.error(err);
      showNotification("更新失敗", "error");
    }
  };

  const toggleUserLock = (user) => {
    updateUser(user.id, { isManualLocked: !user.isManualLocked });
  };

  const extendExpiry = (user, months) => {
    const currentExpiry = new Date(user.expiryDate);
    const newExpiry = new Date(
      currentExpiry.setMonth(currentExpiry.getMonth() + months)
    );
    updateUser(user.id, { expiryDate: newExpiry.toISOString() });
  };

  const addTagToUser = (user, tag) => {
    if (!tag) return;
    const currentTags = user.tags || [];
    if (!currentTags.includes(tag)) {
      updateUser(user.id, { tags: [...currentTags, tag] });
    }
    setTagInput("");
  };

  const removeTagFromUser = (user, tag) => {
    const currentTags = user.tags || [];
    updateUser(user.id, { tags: currentTags.filter((t) => t !== tag) });
  };

  const deleteUser = async (userId) => {
    setConfirmConfig({
      isOpen: true,
      message:
        "確定要刪除此學員資料嗎？這將會刪除該學員所有的繳交紀錄，此動作無法復原。",
      onConfirm: async () => {
        try {
          await deleteDoc(
            doc(db, "artifacts", appId, "public", "data", "users", userId)
          );

          const userSubs = submissions.filter((s) => s.studentId === userId);
          for (const sub of userSubs) {
            await deleteDoc(
              doc(
                db,
                "artifacts",
                appId,
                "public",
                "data",
                "submissions",
                sub.id
              )
            );
          }

          setEditingUser(null);
          showNotification("學員資料已刪除", "info");
        } catch (err) {
          console.error(err);
          showNotification("刪除失敗", "error");
        }
        setConfirmConfig({ ...confirmConfig, isOpen: false });
      },
    });
  };

  // --- 批量選取與刪除功能 ---
  const handleSelectUser = (id) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedUserIds(newSelected);
  };

  const handleSelectAll = () => {
    // 只選取目前篩選/顯示出來的學員
    const visibleIds = sortedUsers.map((u) => u.id);
    // 如果當前頁面所有學員都已被選取，則取消全選；否則全選
    const allSelected = visibleIds.every((id) => selectedUserIds.has(id));

    if (allSelected) {
      // 取消全選（保留非當前頁面的選取？這裡簡單處理：清空或僅移除當前頁面）
      // 為了直覺，這裡選擇清空當前篩選的選取
      const newSelected = new Set(selectedUserIds);
      visibleIds.forEach((id) => newSelected.delete(id));
      setSelectedUserIds(newSelected);
    } else {
      // 全選
      const newSelected = new Set(selectedUserIds);
      visibleIds.forEach((id) => newSelected.add(id));
      setSelectedUserIds(newSelected);
    }
  };

  const handleBulkDelete = () => {
    if (selectedUserIds.size === 0) return;

    setConfirmConfig({
      isOpen: true,
      message: `確定要刪除選取的 ${selectedUserIds.size} 位學員嗎？\n此動作將刪除這些學員的所有資料與繳交紀錄，且無法復原。`,
      onConfirm: async () => {
        try {
          const ids = Array.from(selectedUserIds);
          for (const uid of ids) {
            await deleteDoc(
              doc(db, "artifacts", appId, "public", "data", "users", uid)
            );
            const userSubs = submissions.filter((s) => s.studentId === uid);
            for (const sub of userSubs) {
              await deleteDoc(
                doc(
                  db,
                  "artifacts",
                  appId,
                  "public",
                  "data",
                  "submissions",
                  sub.id
                )
              );
            }
          }
          setSelectedUserIds(new Set());
          showNotification(`已成功刪除 ${ids.length} 位學員`, "success");
        } catch (e) {
          console.error(e);
          showNotification("批量刪除發生錯誤", "error");
        }
        setConfirmConfig({ ...confirmConfig, isOpen: false });
      },
    });
  };

  const openEditUserModal = (u) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditPhone(u.phone);
  };

  const handleSaveUserEdit = () => {
    const trimmedName = (editName || "").trim();
    const trimmedPhone = (editPhone || "").trim();

    if (!trimmedName || !trimmedPhone) {
      showNotification("請輸入完整的姓名與手機號碼", "error");
      return;
    }

    // 手機格式驗證 (新增)
    const phoneRegex = /^09\d{8}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      showNotification("手機號碼格式錯誤，請輸入 09 開頭的 10 碼數字", "error");
      return;
    }

    // 檢查姓名唯一性 (排除自己)
    const duplicateNameUser = users.find(
      (u) => u.name === trimmedName && u.id !== editingUser.id
    );
    if (duplicateNameUser) {
      showNotification(
        `無法修改：姓名 "${trimmedName}" 已被手機 ${duplicateNameUser.phone} 註冊`,
        "error"
      );
      return;
    }

    // 檢查手機唯一性 (排除自己)
    const duplicatePhoneUser = users.find(
      (u) => u.phone === trimmedPhone && u.id !== editingUser.id
    );
    if (duplicatePhoneUser) {
      showNotification(
        `無法修改：手機 "${trimmedPhone}" 已被學員 ${duplicatePhoneUser.name} 註冊`,
        "error"
      );
      return;
    }

    updateUser(editingUser.id, { name: trimmedName, phone: trimmedPhone });
  };

  const switchToSubmission = (sub) => {
    setGradingItem(sub);
    setGradingData({
      score: sub.score || "",
      comment: sub.comment || "",
    });
    setImageZoom(1);
    setImageRotation(0);
    setImageBrightness(100);
    setCurrentImgIndex(0); // Reset image index
  };

  const openGradingModal = (sub) => {
    switchToSubmission(sub);
  };

  const navigateSubmission = (direction) => {
    if (!gradingItem) return;
    const currentIndex = currentViewSubmissions.findIndex(
      (s) => s.id === gradingItem.id
    );
    if (currentIndex === -1) return;

    const newIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;

    if (newIndex >= 0 && newIndex < currentViewSubmissions.length) {
      switchToSubmission(currentViewSubmissions[newIndex]);
    } else {
      showNotification(
        direction === "next" ? "已經是最後一篇了" : "已經是第一篇了",
        "info"
      );
    }
  };

  const saveGrading = async (shouldNavigateNext = false) => {
    const currentMax = getMaxScore(gradingItem.topic);
    if (
      gradingData.score === "" ||
      isNaN(gradingData.score) ||
      gradingData.score < 0 ||
      gradingData.score > currentMax
    ) {
      showNotification(`請輸入 0-${currentMax} 之間的有效分數`, "error");
      return;
    }

    try {
      await updateDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "submissions",
          gradingItem.id
        ),
        {
          status: "graded",
          score: Number(gradingData.score),
          comment: gradingData.comment,
        }
      );

      showNotification("批改完成", "success");

      if (shouldNavigateNext) {
        navigateSubmission("next");
      } else {
        setGradingItem(null);
      }
    } catch (err) {
      console.error(err);
      showNotification("儲存失敗", "error");
    }
  };

  const handleSaveAnnouncement = async (visible) => {
    try {
      await setDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "system_announcement",
          "main"
        ),
        {
          content: announcementText,
          visible: visible,
          targetTags: announcementTargetTags,
          updatedAt: new Date().toISOString(),
        }
      );
      showNotification(visible ? "公告已發布" : "公告已隱藏", "success");
      setIsAnnouncementModalOpen(false);
    } catch (err) {
      console.error(err);
      showNotification("公告更新失敗", "error");
    }
  };

  const toggleAnnouncementTag = (tag) => {
    setAnnouncementTargetTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const exportStudentData = async (user) => {
    setIsExporting(true);
    try {
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
      );
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"
      );

      if (!window.JSZip || !window.saveAs)
        throw new Error("Zip Lib Load Failed");

      const zip = new window.JSZip();
      const userSubs = submissions.filter((s) => s.studentId === user.id);

      if (userSubs.length === 0) {
        showNotification("該學員尚無任何繳交紀錄", "info");
        setIsExporting(false);
        return;
      }

      let textReport = `學員姓名: ${user.name}\n學號: ${
        user.id
      }\n課程期限: ${formatDate(user.expiryDate)}\n\n--- 繳交評分總表 ---\n`;

      const promises = userSubs.map(async (sub, idx) => {
        const dateStr = formatDateTime(sub.date).replace(/[\/\s:]/g, "-");
        const fileName = `篇數${idx + 1}_${dateStr}.jpg`;

        if (sub.imageUrl && sub.imageUrl.startsWith("data:image")) {
          const base64Data = sub.imageUrl.split(",")[1];
          zip.file(fileName, base64Data, { base64: true });
        }

        textReport += `\n[篇數 ${idx + 1}] 日期: ${formatDateTime(sub.date)}\n`;
        textReport += `檔案名稱: ${fileName}\n`;
        textReport += `狀態: ${
          sub.status === "graded" ? "已批改" : "未批改"
        }\n`;
        if (sub.status === "graded") {
          textReport += `分數: ${sub.score}/25\n`;
          textReport += `評語: ${sub.comment}\n`;
        }
        textReport += `-------------------------\n`;
      });

      await Promise.all(promises);
      zip.file("評語總表.txt", textReport);

      const content = await zip.generateAsync({ type: "blob" });
      window.saveAs(content, `${user.name}_作文作品集.zip`);

      showNotification(`已打包完成`, "success");
    } catch (error) {
      console.error("Export Error:", error);
      showNotification("打包失敗", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const generatePortfolio = async (user) => {
    setIsExporting(true);
    try {
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
      );
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
      );

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;

      const userSubs = submissions.filter(
        (s) => s.studentId === user.id && s.status === "graded"
      );
      if (userSubs.length === 0) {
        showNotification("無已批改的作業，無法產生歷程", "error");
        setIsExporting(false);
        return;
      }

      const top3 = [...userSubs].sort((a, b) => b.score - a.score).slice(0, 3);
      const avgScore = (
        userSubs.reduce((acc, curr) => acc + curr.score, 0) / userSubs.length
      ).toFixed(1);

      const captureElement = async (element) => {
        document.body.appendChild(element);
        const canvas = await window.html2canvas(element, {
          scale: 2,
          useCORS: true,
        });
        document.body.removeChild(element);
        return canvas.toDataURL("image/jpeg", 0.95);
      };

      // Page 1 Container (Cover)
      const page1 = document.createElement("div");
      Object.assign(page1.style, {
        width: "210mm",
        minHeight: "297mm",
        backgroundColor: "white",
        padding: "20mm",
        fontFamily: "sans-serif",
      });

      page1.innerHTML = `
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="font-size: 32px; color: #333; margin-bottom: 10px;">陳蒂國文補習班</h1>
          <h2 style="font-size: 24px; color: #555;">學員學習歷程檔案</h2>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
          <h3 style="margin-top: 0; color: #1e293b;">基本資料</h3>
          <p><strong>姓名：</strong>${user.name}</p>
          <p><strong>手機：</strong>${user.phone}</p>
          <p><strong>統計期間：</strong>${formatDate(
            user.startDate
          )} ~ ${formatDate(user.expiryDate)}</p>
        </div>

        <div style="display: flex; gap: 20px; margin-bottom: 30px;">
           <div style="flex: 1; background: #ecfccb; padding: 20px; border-radius: 10px; text-align: center;">
              <div style="font-size: 14px; color: #365314;">繳交篇數</div>
              <div style="font-size: 36px; font-weight: bold; color: #365314;">${
                userSubs.length
              }</div>
           </div>
           <div style="flex: 1; background: #dbeafe; padding: 20px; border-radius: 10px; text-align: center;">
              <div style="font-size: 14px; color: #1e3a8a;">平均分數</div>
              <div style="font-size: 36px; font-weight: bold; color: #1e3a8a;">${avgScore}</div>
           </div>
           <div style="flex: 1; background: #ffedd5; padding: 20px; border-radius: 10px; text-align: center;">
              <div style="font-size: 14px; color: #7c2d12;">最高分數</div>
              <div style="font-size: 36px; font-weight: bold; color: #7c2d12;">${Math.max(
                ...userSubs.map((s) => s.score)
              )}</div>
           </div>
        </div>
      `;

      const imgData1 = await captureElement(page1);
      pdf.addImage(imgData1, "JPEG", 0, 0, pageWidth, pageHeight);

      // Essay Pages
      for (let i = 0; i < top3.length; i++) {
        pdf.addPage();
        const sub = top3[i];

        const pageEssay = document.createElement("div");
        Object.assign(pageEssay.style, {
          width: "210mm",
          minHeight: "297mm",
          backgroundColor: "white",
          padding: "20mm",
          fontFamily: "sans-serif",
        });

        pageEssay.innerHTML = `
           <div style="border-bottom: 2px solid #f59e0b; padding-bottom: 15px; margin-bottom: 30px;">
             <h2 style="margin: 0; color: #b45309;">精選佳作 #${i + 1}</h2>
             <p style="margin: 5px 0 0; color: #666;">繳交日期：${formatDateTime(
               sub.date
             )}</p>
           </div>

           <div style="display: flex; justify-content: space-between; align-items: center; background: #fffbeb; padding: 20px; border-radius: 10px; margin-bottom: 30px;">
              <div>
                 <span style="font-size: 14px; color: #92400e;">本次得分</span>
                 <div style="font-size: 48px; font-weight: bold; color: #b45309;">${
                   sub.score
                 }</div>
              </div>
              <div style="flex: 1; margin-left: 30px;">
                 <h4 style="margin: 0 0 10px; color: #92400e;">老師評語：</h4>
                 <p style="margin: 0; white-space: pre-wrap; color: #333; line-height: 1.6;">${
                   sub.comment || "無評語"
                 }</p>
              </div>
           </div>

           <div style="text-align: center; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
              <img src="${
                sub.imageUrl
              }" style="max-width: 100%; max-height: 140mm; display: block; margin: 0 auto;" />
           </div>
        `;

        const imgDataEssay = await captureElement(pageEssay);
        pdf.addImage(imgDataEssay, "JPEG", 0, 0, pageWidth, pageHeight);
      }

      pdf.save(`${user.name}_學習歷程檔案.pdf`);
      showNotification("學習歷程 PDF 已下載", "success");
    } catch (error) {
      console.error(error);
      showNotification("產生 PDF 失敗", "error");
    } finally {
      setIsExporting(false);
    }
  };

  // 取得當前顯示的圖片 (支援多圖)
  const currentGradingImage = useMemo(() => {
    if (!gradingItem) return null;
    const images = gradingItem.imageUrls || [gradingItem.imageUrl];
    return images[currentImgIndex] || images[0];
  }, [gradingItem, currentImgIndex]);

  return (
    <div className="min-h-screen bg-gray-100">
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
      />

      <nav className="bg-indigo-900 text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <span className="font-bold text-xl">補習班管理後台</span>
              <div className="hidden md:flex space-x-2">
                <button
                  onClick={() => {
                    setActiveTab("folders");
                    setSelectedMonth(null);
                    setFilterStatus("all");
                    setFilterTag("all");
                  }}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeTab === "folders"
                      ? "bg-indigo-700"
                      : "hover:bg-indigo-800"
                  }`}
                >
                  作文批改
                </button>
                <button
                  onClick={() => {
                    setActiveTab("students");
                    setFilterTag("all");
                  }}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeTab === "students"
                      ? "bg-indigo-700"
                      : "hover:bg-indigo-800"
                  }`}
                >
                  學員列表
                </button>
                <button
                  onClick={() => setActiveTab("alerts")}
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1 ${
                    activeTab === "alerts"
                      ? "bg-red-700"
                      : "hover:bg-indigo-800"
                  }`}
                >
                  <Siren
                    size={16}
                    className={
                      totalRisks > 0 ? "animate-pulse text-red-300" : ""
                    }
                  />
                  預警中心
                  {totalRisks > 0 && (
                    <span className="bg-red-500 text-white text-xs px-1.5 rounded-full ml-1">
                      {totalRisks}
                    </span>
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsAnnouncementModalOpen(true)}
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-md text-sm font-bold transition"
              >
                <Megaphone size={16} /> 發布公告
              </button>
              {/* 警示橫幅 */}
              {usagePercentage > 80 && (
                <div
                  className={`hidden md:flex items-center gap-1 text-xs px-2 py-1 rounded font-bold ${
                    usagePercentage > 90
                      ? "bg-red-600 text-white animate-pulse"
                      : "bg-yellow-500 text-white"
                  }`}
                  title="資料庫容量警示"
                >
                  <Database size={14} /> {usagePercentage.toFixed(0)}%
                </div>
              )}
              <button
                onClick={onLogout}
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                登出
              </button>
            </div>
          </div>
        </div>
        <div className="bg-indigo-800 h-1.5 w-full relative group cursor-help">
          <div
            className={`h-full transition-all duration-500 ${
              usagePercentage > 90
                ? "bg-red-500"
                : usagePercentage > 70
                ? "bg-yellow-400"
                : "bg-green-400"
            }`}
            style={{ width: `${usagePercentage}%` }}
          ></div>
          <div className="absolute top-2 left-0 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            資料庫使用量: {formatBytes(dbUsage)} /{" "}
            {formatBytes(COURSE_SETTINGS.dbSizeLimitBytes)} (
            {usagePercentage.toFixed(2)}%)
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* ... (其他 Tab 內容保持不變) ... */}
        {activeTab === "alerts" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Siren className="text-red-500" /> 學習風險預警中心
              </h2>
              <p className="text-gray-600 mt-1">
                系統自動偵測需關注的學員，請行政人員主動聯繫關懷。
              </p>
            </div>

            {/* 資料庫容量監控 */}
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Database className="text-indigo-500" /> 資料庫容量監控
                </h2>
                <span className="text-sm font-bold text-gray-600">
                  {formatBytes(dbUsage)} /{" "}
                  {formatBytes(COURSE_SETTINGS.dbSizeLimitBytes)} (
                  {usagePercentage.toFixed(2)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    usagePercentage > 90
                      ? "bg-red-600 animate-pulse"
                      : usagePercentage > 70
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${usagePercentage}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-right">
                {usagePercentage > 90
                  ? "⚠️ 容量即將額滿，請盡快備份並刪除舊生資料！"
                  : usagePercentage > 70
                  ? "⚠️ 容量使用率較高，建議開始規劃清理資料。"
                  : "✅ 目前容量充足。"}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
                  <h3 className="font-bold text-orange-800 flex items-center gap-2">
                    <TrendingDown size={20} /> 成績退步警示
                  </h3>
                  <span className="bg-orange-200 text-orange-800 text-xs px-2 py-1 rounded-full">
                    {riskAnalysis.regressionRisks.length} 人
                  </span>
                </div>
                <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                  {riskAnalysis.regressionRisks.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      目前沒有連續退步的學員，太棒了！
                    </div>
                  ) : (
                    riskAnalysis.regressionRisks.map(({ user, scores }) => (
                      <div
                        key={user.id}
                        className="p-4 hover:bg-gray-50 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-bold text-gray-800">
                            {user.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {user.phone}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">
                            近期分數走勢
                          </div>
                          <div className="flex items-center gap-1 font-mono font-bold text-red-600">
                            {scores.map((s, i) => (
                              <React.Fragment key={i}>
                                <span>{s}</span>
                                {i < scores.length - 1 && (
                                  <span className="text-gray-300">→</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => setEditingUser(user)}
                          className="p-2 text-gray-400 hover:text-indigo-600"
                        >
                          <Settings size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-4 bg-red-50 border-b border-red-100 flex justify-between items-center">
                  <h3 className="font-bold text-red-800 flex items-center gap-2">
                    <Clock size={20} /> 怠惰/失聯警示 (&gt;14天)
                  </h3>
                  <span className="bg-red-200 text-red-800 text-xs px-2 py-1 rounded-full">
                    {riskAnalysis.inactivityRisks.length} 人
                  </span>
                </div>
                <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                  {riskAnalysis.inactivityRisks.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      所有學員近期皆有活動。
                    </div>
                  ) : (
                    riskAnalysis.inactivityRisks.map(
                      ({ user, days, lastActive }) => (
                        <div
                          key={user.id}
                          className="p-4 hover:bg-gray-50 flex justify-between items-center"
                        >
                          <div>
                            <div className="font-bold text-gray-800">
                              {user.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {user.phone}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-red-600">
                              {days} 天未活動
                            </div>
                            <div className="text-xs text-gray-400">
                              最後活動: {formatDate(lastActive.toISOString())}
                            </div>
                          </div>
                          <button
                            onClick={() => setEditingUser(user)}
                            className="p-2 text-gray-400 hover:text-indigo-600"
                          >
                            <Settings size={18} />
                          </button>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "folders" && (
          <div className="space-y-6">
            {!selectedMonth ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {submissionsByMonth.length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-10">
                    目前尚無任何繳交紀錄
                  </div>
                )}
                {submissionsByMonth.map(([month, subs]) => {
                  const pendingCount = subs.filter(
                    (s) => s.status === "pending"
                  ).length;
                  return (
                    <button
                      key={month}
                      onClick={() => {
                        setSelectedMonth(month);
                        setFilterStatus("all");
                        setFilterTag("all");
                      }}
                      className="bg-white p-6 rounded-xl shadow hover:shadow-md transition flex flex-col items-center justify-center gap-2 border border-gray-200 group relative"
                    >
                      {pendingCount > 0 && (
                        <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full animate-bounce">
                          {pendingCount}
                        </div>
                      )}
                      <Folder
                        className="text-yellow-400 w-12 h-12 group-hover:scale-110 transition-transform"
                        fill="currentColor"
                      />
                      <span className="font-bold text-lg text-gray-700">
                        {month}
                      </span>
                      <div className="text-xs text-gray-500 mt-1">
                        {pendingCount > 0 ? (
                          <span className="text-red-500 font-bold">
                            {pendingCount} 篇待批
                          </span>
                        ) : (
                          "全數已改"
                        )}{" "}
                        / {subs.length} 總數
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow min-h-[500px]">
                {/* 頂部工具列 */}
                <div className="p-4 border-b flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <button
                      onClick={() => setSelectedMonth(null)}
                      className="text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      ← 返回資料夾
                    </button>
                    <h2 className="text-xl font-bold">
                      {selectedMonth} 繳交紀錄
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {/* 標籤篩選器 */}
                    <div className="relative">
                      <select
                        value={filterTag}
                        onChange={(e) => setFilterTag(e.target.value)}
                        className="appearance-none bg-gray-100 border border-gray-200 text-gray-700 py-1.5 pl-3 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500 text-xs font-bold"
                      >
                        <option value="all">所有標籤</option>
                        {availableTags.map((tag) => (
                          <option key={tag} value={tag}>
                            #{tag}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <Filter size={12} />
                      </div>
                    </div>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button
                        onClick={() => setFilterStatus("all")}
                        className={`px-3 py-1 rounded text-xs font-medium transition ${
                          filterStatus === "all"
                            ? "bg-white shadow text-indigo-600"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        全部
                      </button>
                      <button
                        onClick={() => setFilterStatus("pending")}
                        className={`px-3 py-1 rounded text-xs font-medium transition ${
                          filterStatus === "pending"
                            ? "bg-white shadow text-red-600"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        待批改
                      </button>
                      <button
                        onClick={() => setFilterStatus("graded")}
                        className={`px-3 py-1 rounded text-xs font-medium transition ${
                          filterStatus === "graded"
                            ? "bg-white shadow text-green-600"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        已批改
                      </button>
                    </div>
                  </div>
                </div>

                {/* 月份成績儀表板 */}
                {monthAnalytics && (
                  <div className="bg-indigo-50 border-b border-indigo-100 p-4 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-down">
                    <div className="flex flex-col gap-4">
                      {/* 基礎數據 */}
                      <div className="flex items-center justify-around">
                        <div className="text-center">
                          <p className="text-xs text-indigo-600 font-medium uppercase">
                            平均分數
                          </p>
                          <p className="text-3xl font-bold text-indigo-900">
                            {monthAnalytics.avg}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-indigo-600 font-medium uppercase">
                            最高分
                          </p>
                          <p className="text-3xl font-bold text-indigo-900">
                            {monthAnalytics.max}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-indigo-600 font-medium uppercase">
                            批改進度
                          </p>
                          <p className="text-3xl font-bold text-indigo-900">
                            {monthAnalytics.total}
                            <span className="text-sm font-normal text-indigo-500">
                              {" "}
                              篇
                            </span>
                          </p>
                        </div>
                      </div>
                      {/* 主題分析 */}
                      <div className="bg-white p-3 rounded-lg shadow-sm border border-indigo-100">
                        <h4 className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1">
                          <BookOpen size={12} /> 主題成效分析
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(monthAnalytics.topicStats).map(
                            ([topic, stats]) => (
                              <div
                                key={topic}
                                className="flex justify-between items-center text-xs p-1.5 bg-gray-50 rounded"
                              >
                                <span className="text-gray-600 font-medium">
                                  {topic}
                                </span>
                                <span className="text-indigo-600 font-bold">
                                  {stats.avg} 分{" "}
                                  <span className="text-gray-400 font-normal">
                                    ({stats.count})
                                  </span>
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      {/* 分數分佈 */}
                      <div className="flex justify-between items-center mb-1 text-xs text-indigo-700 font-medium">
                        <span>成績分布</span>
                        <BarChart3 size={14} />
                      </div>
                      <div className="space-y-1.5">
                        {/* A+ */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-12 text-right text-gray-600">
                            A+級
                          </span>
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-emerald-600 h-1.5 rounded-full"
                              style={{
                                width: `${
                                  (monthAnalytics.dist.levelAp /
                                    monthAnalytics.total) *
                                  100
                                }%`,
                              }}
                            ></div>
                          </div>
                          <span className="w-6 text-right text-gray-500">
                            {monthAnalytics.dist.levelAp}
                          </span>
                        </div>
                        {/* A */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-12 text-right text-gray-600">
                            A級
                          </span>
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-emerald-400 h-1.5 rounded-full"
                              style={{
                                width: `${
                                  (monthAnalytics.dist.levelA /
                                    monthAnalytics.total) *
                                  100
                                }%`,
                              }}
                            ></div>
                          </div>
                          <span className="w-6 text-right text-gray-500">
                            {monthAnalytics.dist.levelA}
                          </span>
                        </div>
                        {/* B+ */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-12 text-right text-gray-600">
                            B+級
                          </span>
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full"
                              style={{
                                width: `${
                                  (monthAnalytics.dist.levelBp /
                                    monthAnalytics.total) *
                                  100
                                }%`,
                              }}
                            ></div>
                          </div>
                          <span className="w-6 text-right text-gray-500">
                            {monthAnalytics.dist.levelBp}
                          </span>
                        </div>
                        {/* B */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-12 text-right text-gray-600">
                            B級
                          </span>
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-yellow-500 h-1.5 rounded-full"
                              style={{
                                width: `${
                                  (monthAnalytics.dist.levelB /
                                    monthAnalytics.total) *
                                  100
                                }%`,
                              }}
                            ></div>
                          </div>
                          <span className="w-6 text-right text-gray-500">
                            {monthAnalytics.dist.levelB}
                          </span>
                        </div>
                        {/* C+ */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-12 text-right text-gray-600">
                            C+級
                          </span>
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-orange-500 h-1.5 rounded-full"
                              style={{
                                width: `${
                                  (monthAnalytics.dist.levelCp /
                                    monthAnalytics.total) *
                                  100
                                }%`,
                              }}
                            ></div>
                          </div>
                          <span className="w-6 text-right text-gray-500">
                            {monthAnalytics.dist.levelCp}
                          </span>
                        </div>
                        {/* C */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-12 text-right text-gray-600">
                            C級
                          </span>
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-red-500 h-1.5 rounded-full"
                              style={{
                                width: `${
                                  (monthAnalytics.dist.levelC /
                                    monthAnalytics.total) *
                                  100
                                }%`,
                              }}
                            ></div>
                          </div>
                          <span className="w-6 text-right text-gray-500">
                            {monthAnalytics.dist.levelC}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          繳交日期
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          學員姓名
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          狀態
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          分數
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentViewSubmissions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime(sub.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {sub.studentName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                sub.status === "graded"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {sub.status === "graded" ? "已批改" : "待批改"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {sub.score !== null ? sub.score : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => openGradingModal(sub)}
                              className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1"
                            >
                              <FileText size={16} />{" "}
                              {sub.status === "graded" ? "修改" : "批改"}
                            </button>
                            {/* 顯示主題標籤 */}
                            {sub.topic && (
                              <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                {sub.topic}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ... (其他 Tab 與 Modal 保持不變) ... */}
        {activeTab === "students" && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-gray-700">
                  學員列表 ({users.length}人)
                </h3>
                {/* 批量操作工具列 */}
                {selectedUserIds.size > 0 && (
                  <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 animate-fade-in">
                    <span className="text-sm font-bold text-red-700">
                      已選取 {selectedUserIds.size} 人
                    </span>
                    <div className="h-4 w-px bg-red-200 mx-1"></div>
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800 font-medium"
                    >
                      <Trash2 size={14} /> 批量刪除
                    </button>
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-500">
                點擊標題可切換排序順序
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                        checked={
                          sortedUsers.length > 0 &&
                          sortedUsers.every((u) => selectedUserIds.has(u.id))
                        }
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      姓名/手機
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      標籤
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600"
                      onClick={() => handleSort("remainingDays")}
                    >
                      <div className="flex items-center gap-1">
                        剩餘天數
                        {sortConfig.key === "remainingDays" &&
                          (sortConfig.direction === "asc" ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          ))}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      已交篇數
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      權限狀態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      設定
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedUsers.map((u) => {
                    const days = calculateRemainingDays(u.expiryDate);
                    const subCount = submissions.filter(
                      (s) => s.studentId === u.id
                    ).length;
                    const isSelected = selectedUserIds.has(u.id);

                    let dayColorClass = "text-green-600 font-bold";
                    let warningIcon = null;
                    if (days < 7) {
                      dayColorClass = "text-red-600 font-bold";
                      warningIcon = (
                        <AlertTriangle
                          size={16}
                          className="text-red-600 inline mr-1"
                        />
                      );
                    } else if (days <= 30) {
                      dayColorClass = "text-yellow-600 font-bold";
                    }

                    return (
                      <tr
                        key={u.id}
                        className={isSelected ? "bg-indigo-50" : ""}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                            checked={isSelected}
                            onChange={() => handleSelectUser(u.id)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {u.name}
                          </div>
                          <div className="text-sm text-gray-500">{u.phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {u.tags &&
                              u.tags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded border border-gray-200"
                                >
                                  #{tag}
                                </span>
                              ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {warningIcon}
                            <span className={`text-sm ${dayColorClass}`}>
                              {days} 天
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDate(u.expiryDate)} 到期
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {subCount} / {COURSE_SETTINGS.maxEssays}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {u.isManualLocked ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              已停權
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              正常
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => openEditUserModal(u)}
                            className="text-gray-500 hover:text-indigo-600 transition"
                            title="管理學員"
                          >
                            <Settings size={20} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* 公告編輯 Modal */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="bg-yellow-50 p-4 border-b border-yellow-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-yellow-800 flex items-center gap-2">
                <Megaphone size={20} /> 班級公告管理
              </h3>
              <button
                onClick={() => setIsAnnouncementModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  發送對象 (不選則為全體)
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleAnnouncementTag(tag)}
                      className={`text-xs px-2 py-1 rounded border transition ${
                        announcementTargetTags.includes(tag)
                          ? "bg-yellow-500 text-white border-yellow-600"
                          : "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows="6"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none resize-none mb-4"
                placeholder="請輸入公告內容..."
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleSaveAnnouncement(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 font-medium"
                >
                  隱藏公告
                </button>
                <button
                  onClick={() => handleSaveAnnouncement(true)}
                  className="flex-1 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-bold shadow"
                >
                  發布公告
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 學員管理 Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] animate-fade-in-up">
            <div className="bg-gray-50 p-4 border-b flex justify-between items-center flex-shrink-0">
              <h3 className="font-bold text-lg text-gray-800">學員管理設定</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="space-y-4 border-b border-gray-100 pb-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
                    <User size={24} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">
                      學員姓名
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full text-lg font-bold border-b border-gray-300 focus:border-indigo-500 outline-none pb-1"
                    />
                  </div>
                </div>
                <div className="pl-[60px]">
                  <label className="block text-xs text-gray-500 mb-1">
                    手機號碼 (登入帳號)
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full text-sm text-gray-600 border-b border-gray-300 focus:border-indigo-500 outline-none pb-1"
                  />
                </div>
                <button
                  onClick={handleSaveUserEdit}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold text-sm transition"
                >
                  儲存基本資料變更
                </button>
              </div>

              {/* 標籤管理區 */}
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  學員標籤
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {editingUser.tags &&
                    editingUser.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded flex items-center gap-1"
                      >
                        #{tag}
                        <button
                          onClick={() => removeTagFromUser(editingUser, tag)}
                          className="hover:text-red-500"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="新增標籤"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm outline-none focus:border-indigo-500"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        addTagToUser(editingUser, tagInput);
                    }}
                  />
                  <button
                    onClick={() => addTagToUser(editingUser, tagInput)}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-indigo-700"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                  <div>
                    <span className="block font-medium text-gray-700">
                      繳交權限
                    </span>
                    <span className="text-xs text-gray-500">
                      {editingUser.isManualLocked
                        ? "目前：已鎖定"
                        : "目前：正常可繳交"}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleUserLock(editingUser)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                      editingUser.isManualLocked
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-red-100 text-red-700 hover:bg-red-200"
                    }`}
                  >
                    {editingUser.isManualLocked ? "開啟權限" : "暫停權限"}
                  </button>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <span className="block font-medium text-gray-700 mb-2">
                    課程延期 (目前: {formatDate(editingUser.expiryDate)})
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => extendExpiry(editingUser, 1)}
                      className="bg-white border hover:bg-blue-50 hover:border-blue-300 text-blue-600 py-2 rounded text-sm font-medium transition"
                    >
                      + 1 個月
                    </button>
                    <button
                      onClick={() => extendExpiry(editingUser, 2)}
                      className="bg-white border hover:bg-blue-50 hover:border-blue-300 text-blue-600 py-2 rounded text-sm font-medium transition"
                    >
                      + 2 個月
                    </button>
                    <button
                      onClick={() => extendExpiry(editingUser, 3)}
                      className="bg-white border hover:bg-blue-50 hover:border-blue-300 text-blue-600 py-2 rounded text-sm font-medium transition"
                    >
                      + 3 個月
                    </button>
                  </div>
                </div>

                {/* 學習歷程 PDF 產生按鈕 */}
                <button
                  onClick={() => generatePortfolio(editingUser)}
                  disabled={isExporting}
                  className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white py-3 rounded-lg font-bold shadow-md transition transform hover:scale-[1.02] ${
                    isExporting ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isExporting ? (
                    <Loader className="animate-spin" size={20} />
                  ) : (
                    <Printer size={20} />
                  )}
                  {isExporting ? "正在製作 PDF..." : "產生學習歷程 PDF"}
                </button>

                <button
                  onClick={() => exportStudentData(editingUser)}
                  disabled={isExporting}
                  className={`w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-3 rounded-lg font-medium transition ${
                    isExporting ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isExporting ? (
                    <Loader className="animate-spin" size={18} />
                  ) : (
                    <Mail size={18} />
                  )}
                  {isExporting ? "打包中..." : "下載作品集原始檔 (ZIP)"}
                </button>

                <hr className="border-gray-100" />

                <button
                  onClick={() => deleteUser(editingUser.id)}
                  className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 py-3 rounded-lg font-medium transition"
                >
                  <Trash2 size={18} /> 刪除此學員資料
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 批改 Modal */}
      {gradingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden">
            {/* Header (新增導航) */}
            <div className="absolute top-4 left-4 z-20 flex gap-2">
              <button
                onClick={() => navigateSubmission("prev")}
                className="bg-white/20 hover:bg-white/40 text-white px-3 py-2 rounded-lg flex items-center gap-1 backdrop-blur-sm transition"
              >
                <ChevronLeft size={20} /> 上一篇
              </button>
              <button
                onClick={() => navigateSubmission("next")}
                className="bg-white/20 hover:bg-white/40 text-white px-3 py-2 rounded-lg flex items-center gap-1 backdrop-blur-sm transition"
              >
                下一篇 <ChevronRight size={20} />
              </button>
            </div>

            <div className="md:w-2/3 bg-gray-900 p-4 flex flex-col items-center justify-center relative min-h-[400px]">
              {/* 多圖切換按鈕 (如果有多張) */}
              {gradingItem.imageUrls?.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setCurrentImgIndex((p) => Math.max(0, p - 1))
                    }
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 p-2 rounded-full text-white hover:bg-white/40 z-20"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentImgIndex((p) =>
                        Math.min(gradingItem.imageUrls.length - 1, p + 1)
                      )
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 p-2 rounded-full text-white hover:bg-white/40 z-20"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}

              {/* 工具列 */}
              <div className="absolute top-4 right-4 flex space-x-2 z-10">
                {/* 旋轉控制 */}
                <button
                  onClick={() => setImageRotation((r) => r - 90)}
                  className="bg-white/20 hover:bg-white/40 text-white p-2 rounded"
                  title="向左旋轉"
                >
                  <RotateCcw size={20} />
                </button>
                <button
                  onClick={() => setImageRotation((r) => r + 90)}
                  className="bg-white/20 hover:bg-white/40 text-white p-2 rounded"
                  title="向右旋轉"
                >
                  <RotateCw size={20} />
                </button>
                <div className="w-4"></div> {/* Spacer */}
                {/* 縮放控制 */}
                <button
                  onClick={() => setImageZoom((z) => z + 0.2)}
                  className="bg-white/20 hover:bg-white/40 text-white p-2 rounded"
                  title="放大"
                >
                  <ZoomIn size={20} />
                </button>
                <button
                  onClick={() => setImageZoom((z) => Math.max(0.5, z - 0.2))}
                  className="bg-white/20 hover:bg-white/40 text-white p-2 rounded"
                  title="縮小"
                >
                  <ZoomOut size={20} />
                </button>
                <a
                  href={currentGradingImage}
                  download={`essay_${gradingItem.studentName}.jpg`}
                  className="bg-white/20 hover:bg-white/40 text-white p-2 rounded"
                  title="下載原圖"
                >
                  <Download size={20} />
                </a>
              </div>

              {/* 亮度滑桿 (置於底部) */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 bg-black/50 px-4 py-2 rounded-full text-white z-10 w-64">
                <Sun size={16} className="opacity-70" />
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={imageBrightness}
                  onChange={(e) => setImageBrightness(e.target.value)}
                  className="w-full h-1 bg-gray-400 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="overflow-auto w-full h-full flex items-center justify-center bg-gray-800/50 rounded-lg">
                <img
                  src={currentGradingImage}
                  alt="Essay"
                  className="transition-all duration-300 ease-out max-w-none origin-center"
                  style={{
                    transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                    filter: `brightness(${imageBrightness}%)`,
                  }}
                />
              </div>
            </div>

            <div className="md:w-1/3 p-6 bg-white flex flex-col border-l border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">批改作業</h3>
                  <p className="text-sm text-gray-500">
                    {gradingItem.studentName} -{" "}
                    {formatDateTime(gradingItem.date)}
                  </p>
                </div>
                <button
                  onClick={() => setGradingItem(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto">
                <div className="flex gap-4">
                  <div className="flex-1">
                    {(() => {
                      const currentMax = getMaxScore(gradingItem.topic);
                      return (
                        <>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            得分 (滿分{currentMax})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={currentMax}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg font-bold text-indigo-700"
                            value={gradingData.score}
                            onChange={(e) =>
                              setGradingData({
                                ...gradingData,
                                score: e.target.value,
                              })
                            }
                          />
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between items-center">
                    老師評語
                  </label>
                  <textarea
                    rows="8"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                    placeholder="請輸入評語..."
                    value={gradingData.comment}
                    onChange={(e) =>
                      setGradingData({
                        ...gradingData,
                        comment: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col gap-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => setGradingItem(null)}
                    className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 font-medium"
                  >
                    暫存 / 取消
                  </button>
                  <button
                    onClick={() => saveGrading(false)}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow"
                  >
                    完成並關閉
                  </button>
                </div>
                <button
                  onClick={() => saveGrading(true)}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow flex items-center justify-center gap-2"
                >
                  <Save size={18} /> 儲存並評下一篇
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
