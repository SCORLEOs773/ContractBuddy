import { useState, useEffect, useRef } from "react";
import api from "../lib/axios";
import {
  Upload,
  FileText,
  LogOut,
  Trash2,
  Eye,
  Calendar,
  Flag,
  Send,
  Bot,
} from "lucide-react";

interface Clause {
  clause: string;
  risk: number;
  explanation: string;
}

interface Analysis {
  overall_risk: number;
  summary: string;
  top_risks?: string[];
  clauses?: Clause[];
}

interface Contract {
  id: number;
  filename: string;
  jurisdiction: string;
  risk_report: string | Analysis;
  created_at: string;
}

interface CurrentUser {
  full_name: string;
  email: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");

  // User Info
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // New Analysis
  const [file, setFile] = useState<File | null>(null);
  const [jurisdiction, setJurisdiction] = useState("India");
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [currentResult, setCurrentResult] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [uploadError, setUploadError] = useState("");

  // History
  const [history, setHistory] = useState<Contract[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // AI Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Language Selector (only for chat)
  const [responseLanguage, setResponseLanguage] = useState<
    "english" | "hinglish" | "hindi"
  >("hinglish");

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await api.get("/auth/me");
        setCurrentUser(res.data);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        console.error("Failed to fetch user info");
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (activeTab === "history") fetchHistory();
  }, [activeTab]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get("/contracts/");
      setHistory(res.data);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      console.error("Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setUploadError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("jurisdiction", jurisdiction);

    try {
      const res = await api.post("/contracts/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCurrentResult(res.data);
      setMessages([]);
      if (activeTab === "history") fetchHistory();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setUploadError(err.response?.data?.detail || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !currentResult || chatLoading) return;

    const userMessage = chatInput.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await api.post("/contracts/chat", {
        contract_id: currentResult.id,
        message: userMessage,
        language: responseLanguage,
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.response },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't process that. Please try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const deleteContract = async (id: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await api.delete(`/contracts/${id}`);
      fetchHistory();
      if (currentResult?.id === id) setCurrentResult(null);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      alert("Failed to delete document");
    }
  };

  const viewContract = (contract: Contract) => {
    let analysisData = contract.risk_report;
    if (typeof analysisData === "string") {
      try {
        analysisData = JSON.parse(analysisData);
      } catch {
        analysisData = { overall_risk: 50, summary: "Analysis unavailable" };
      }
    }

    setCurrentResult({
      id: contract.id,
      filename: contract.filename,
      analysis: analysisData,
    });
    setMessages([]);
    setActiveTab("new");
  };

  const getRiskColor = (risk: number) => {
    if (risk > 70) return "text-red-600";
    if (risk > 40) return "text-amber-600";
    return "text-emerald-600";
  };

  const currentRisk = currentResult?.analysis?.overall_risk || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navbar */}
      <nav className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-2xl">
              <FileText size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                ContractBuddy
              </h1>
              <p className="text-xs text-gray-500 -mt-1">
                India's Personal Legal Guardian
              </p>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Flag size={18} />
              <span>🇮🇳 India Mode</span>
            </div>

            {/* Language Selector - Only for Chat */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">
                Chat Language:
              </label>
              <select
                value={responseLanguage}
                onChange={(e) =>
                  setResponseLanguage(
                    e.target.value as "english" | "hinglish" | "hindi",
                  )
                }
                className="border border-gray-300 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:border-blue-600"
              >
                <option value="english">English</option>
                <option value="hinglish">Hinglish</option>
                <option value="hindi">हिंदी</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center font-semibold text-lg">
                {currentUser?.full_name
                  ? currentUser.full_name.charAt(0).toUpperCase()
                  : "?"}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {currentUser?.full_name || "Loading..."}
                </p>
                <p className="text-xs text-gray-500">
                  {currentUser?.email || ""}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem("token");
                window.location.href = "/login";
              }}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 transition"
            >
              <LogOut size={20} /> Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-10">
        {/* Tabs */}
        <div className="flex border-b mb-10">
          <button
            onClick={() => setActiveTab("new")}
            className={`px-8 py-4 font-semibold text-lg border-b-4 transition-all ${
              activeTab === "new"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            New Analysis
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-8 py-4 font-semibold text-lg border-b-4 transition-all ${
              activeTab === "history"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            My Documents ({history.length})
          </button>
        </div>

        {/* NEW ANALYSIS TAB */}
        {activeTab === "new" && (
          <div className="space-y-10">
            <div className="bg-white rounded-3xl shadow-xl p-10">
              <h2 className="text-3xl font-bold mb-8">Upload New Document</h2>
              <form onSubmit={handleUpload} className="space-y-8">
                <div>
                  <label className="block text-sm font-medium mb-3">
                    Jurisdiction
                  </label>
                  <select
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    className="w-full p-5 border-2 border-gray-200 rounded-3xl focus:border-blue-600 text-lg"
                  >
                    <option value="India">🇮🇳 India</option>
                    <option value="USA">🇺🇸 USA</option>
                    <option value="EU">🇪🇺 EU</option>
                  </select>
                </div>

                <div
                  className="border-4 border-dashed border-gray-300 rounded-3xl p-20 text-center hover:border-blue-500 transition cursor-pointer"
                  onClick={() =>
                    document.getElementById("file-upload")?.click()
                  }
                >
                  <Upload className="mx-auto h-16 w-16 text-gray-400 mb-6" />
                  <p className="text-2xl font-medium">
                    Drop your document here
                  </p>
                  <p className="text-gray-500 mt-2">
                    PDF, DOCX, or scanned images supported
                  </p>
                  <input
                    type="file"
                    id="file-upload"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    accept=".pdf,.docx,.png,.jpg,.jpeg"
                  />
                  {file && (
                    <p className="mt-8 text-green-600 font-medium">
                      Selected: {file.name}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!file || loading}
                  className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold rounded-3xl disabled:opacity-50 transition"
                >
                  {loading ? "Analyzing with AI..." : "Analyze Document"}
                </button>
              </form>
            </div>

            {currentResult && (
              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 lg:col-span-4">
                  <div className="bg-white rounded-3xl shadow-xl p-8 h-full">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-bold">Risk Score</h3>
                      <div
                        className={`text-7xl font-black ${getRiskColor(currentRisk)}`}
                      >
                        {currentRisk}
                      </div>
                    </div>

                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-8">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          currentRisk > 70
                            ? "bg-red-500"
                            : currentRisk > 40
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        }`}
                        style={{ width: `${currentRisk}%` }}
                      />
                    </div>

                    <p className="text-gray-700 leading-relaxed">
                      {currentResult.analysis?.summary ||
                        "No summary available"}
                    </p>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-8">
                  <div className="bg-white rounded-3xl shadow-xl p-8">
                    <h3 className="text-2xl font-bold mb-6">
                      Key Clauses & Risks
                    </h3>
                    <div className="space-y-6">
                      {currentResult.analysis?.clauses?.length > 0 ? (
                        currentResult.analysis.clauses.map(
                          (clause: Clause, index: number) => (
                            <div
                              key={index}
                              className="border border-gray-100 rounded-3xl p-7 hover:shadow transition"
                            >
                              <div className="flex justify-between items-start">
                                <h4 className="font-semibold text-lg">
                                  {clause.clause}
                                </h4>
                                <span
                                  className={`px-5 py-2 text-sm font-medium rounded-3xl ${clause.risk > 60 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
                                >
                                  Risk {clause.risk}
                                </span>
                              </div>
                              <p className="text-gray-700 mt-4">
                                {clause.explanation}
                              </p>
                            </div>
                          ),
                        )
                      ) : (
                        <p className="text-gray-500 italic">
                          No specific clauses detected yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="bg-white rounded-3xl shadow-xl p-8">
            <h2 className="text-3xl font-bold mb-8">Your Previous Documents</h2>
            {historyLoading ? (
              <p>Loading your documents...</p>
            ) : history.length === 0 ? (
              <p className="text-gray-500 text-center py-20">
                No documents yet. Start by uploading one!
              </p>
            ) : (
              <div className="grid gap-6">
                {history.map((contract) => (
                  <div
                    key={contract.id}
                    className="border rounded-3xl p-6 flex justify-between items-center hover:shadow transition"
                  >
                    <div className="flex items-center gap-5">
                      <FileText className="text-blue-600" size={36} />
                      <div>
                        <p className="font-medium text-lg">
                          {contract.filename}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center gap-2">
                          <Calendar size={16} />{" "}
                          {new Date(contract.created_at).toLocaleDateString(
                            "en-IN",
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button
                        onClick={() => viewContract(contract)}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700"
                      >
                        <Eye size={20} /> View
                      </button>
                      <button
                        onClick={() => deleteContract(contract.id)}
                        className="flex items-center gap-2 px-6 py-3 bg-red-100 text-red-600 rounded-2xl hover:bg-red-200"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Chat Sidebar */}
      {currentResult && (
        <div className="w-96 bg-white rounded-3xl shadow-2xl p-6 flex flex-col fixed right-8 top-24 bottom-8 overflow-hidden border border-gray-100">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
            <div className="bg-blue-600 text-white p-2 rounded-2xl">
              <Bot size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-xl">ContractBuddy Assistant</h3>
              <p className="text-xs text-gray-500">
                Ask anything about this document
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-12">
                Hi! I'm your personal contract assistant.
                <br />
                <br />
                You can ask me:
                <br />
                • Can they fire me without notice?
                <br />
                • Is this non-compete fair?
                <br />• Help me negotiate better terms
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-3xl ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="text-gray-500 text-sm">
                ContractBuddy is thinking...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex gap-2 pt-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
              placeholder="Ask me anything about this contract..."
              className="flex-1 border border-gray-300 rounded-3xl px-5 py-3 focus:outline-none focus:border-blue-600 text-sm"
            />
            <button
              onClick={sendChatMessage}
              disabled={!chatInput.trim() || chatLoading}
              className="bg-blue-600 text-white p-3 rounded-3xl hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <Send size={22} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
