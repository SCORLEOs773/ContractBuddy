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
  Download,
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
  const [activeTab, setActiveTab] = useState<
    "new" | "history" | "generate" | "compare"
  >("new");

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

  // Negotiation Assistant
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [negotiationLoading, setNegotiationLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [negotiationResult, setNegotiationResult] = useState<string>("");

  // Language Selector (only for chat)
  const [responseLanguage, setResponseLanguage] = useState<
    "english" | "hinglish" | "hindi"
  >("hinglish");

  // Generate & Compare Tab
  const [contractDescription, setContractDescription] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [generateLoading, setGenerateLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [generatedContract, setGeneratedContract] = useState<string>("");

  // Compare Tab
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [compareResult, setCompareResult] = useState<any>(null);

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

  const generateNegotiationHelp = async () => {
    if (!currentResult) return;

    setNegotiationLoading(true);
    setNegotiationResult("");

    try {
      const res = await api.post("/contracts/negotiate", {
        contract_id: currentResult.id,
      });

      setNegotiationResult(res.data.suggestion);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setNegotiationResult(
        "Sorry, I couldn't generate negotiation suggestions right now. Please try again.",
      );
    } finally {
      setNegotiationLoading(false);
    }
  };

  const generateContract = async () => {
    if (!contractDescription.trim()) return;

    setGenerateLoading(true);
    try {
      const res = await api.post("/contracts/generate", {
        description: contractDescription,
        jurisdiction: "India",
      });
      setGeneratedContract(res.data.contract);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    } catch (err: any) {
      alert("Failed to generate contract. Please try again.");
    } finally {
      setGenerateLoading(false);
    }
  };

  const downloadAsDocx = () => {
    const blob = new Blob([generatedContract], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Generated_Contract.docx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsPdf = () => {
    alert(
      "PDF download will be added in the next update (requires extra library). For now, you can copy the text and paste into Word and save as PDF.",
    );
    navigator.clipboard.writeText(generatedContract);
  };

  // Compare Two Documents
  const runComparison = async () => {
    if (!file1 || !file2) {
      alert("Please upload both documents for comparison.");
      return;
    }

    setCompareLoading(true);
    setCompareResult(null);

    const formData = new FormData();
    formData.append("file1", file1);
    formData.append("file2", file2);
    formData.append("jurisdiction", "India");

    try {
      const res = await api.post("/contracts/compare", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCompareResult(res.data);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    } catch (err: any) {
      alert("Comparison failed. Please try again.");
    } finally {
      setCompareLoading(false);
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
        {/* 4 Tabs */}
        <div className="flex border-b mb-10 overflow-x-auto">
          <button
            onClick={() => setActiveTab("new")}
            className={`px-8 py-4 font-semibold text-lg border-b-4 transition-all whitespace-nowrap ${activeTab === "new" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            New Analysis
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-8 py-4 font-semibold text-lg border-b-4 transition-all whitespace-nowrap ${activeTab === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            My Documents ({history.length})
          </button>
          <button
            onClick={() => setActiveTab("generate")}
            className={`px-8 py-4 font-semibold text-lg border-b-4 transition-all whitespace-nowrap ${activeTab === "generate" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Generate Contract
          </button>
          <button
            onClick={() => setActiveTab("compare")}
            className={`px-8 py-4 font-semibold text-lg border-b-4 transition-all whitespace-nowrap ${activeTab === "compare" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Compare Documents
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

            {/* Analysis Result Section + Negotiation Assistant */}
            {currentResult && (
              <div className="grid grid-cols-12 gap-8">
                {/* Risk Overview */}
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

                {/* Clauses */}
                <div className="col-span-12 lg:col-span-5">
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

                {/* Negotiation Assistant Panel */}
                <div className="col-span-12 lg:col-span-3">
                  <div className="bg-white rounded-3xl shadow-xl p-8 sticky top-8">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <span>🤝</span> Negotiation Helper
                    </h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Get custom counter-proposals and email templates
                    </p>

                    <button
                      onClick={() => generateNegotiationHelp()}
                      disabled={negotiationLoading}
                      className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-3xl hover:from-green-700 hover:to-emerald-700 transition disabled:opacity-50"
                    >
                      {negotiationLoading
                        ? "Generating..."
                        : "Help Me Negotiate Better Terms"}
                    </button>

                    {negotiationResult && (
                      <div className="mt-6 text-sm bg-gray-50 p-6 rounded-2xl border border-gray-200">
                        <div className="font-medium mb-4 text-gray-800">
                          Suggested Negotiation Strategy:
                        </div>
                        <div
                          className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: negotiationResult
                              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold
                              .replace(
                                /^### (.*$)/gm,
                                '<h3 class="font-bold mt-4 mb-2">$1</h3>',
                              )
                              .replace(
                                /^## (.*$)/gm,
                                '<h2 class="font-bold mt-5 mb-2">$1</h2>',
                              )
                              .replace(
                                /^\* (.*$)/gm,
                                '<li class="ml-4">• $1</li>',
                              ) // Bullet points
                              .replace(/\n/g, "<br>"),
                          }}
                        />
                      </div>
                    )}
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

        {/* Generate Contract Tab */}
        {activeTab === "generate" && (
          <div className="space-y-10">
            <div className="bg-white rounded-3xl shadow-xl p-10">
              <h2 className="text-3xl font-bold mb-2">
                Smart Contract Generator
              </h2>
              <p className="text-gray-600 mb-8">
                Describe what you need and get a fair, India-specific contract
                instantly
              </p>

              <textarea
                value={contractDescription}
                onChange={(e) => setContractDescription(e.target.value)}
                placeholder="Example: Create a 3-month freelance graphic design agreement for Punjab. Total amount ₹80,000, 50% advance, 15-day notice period, work done on time."
                className="w-full h-48 p-6 border-2 border-gray-200 rounded-3xl focus:border-blue-600 text-lg resize-y"
              />

              <button
                onClick={generateContract}
                disabled={!contractDescription.trim() || generateLoading}
                className="mt-8 w-full py-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-xl rounded-3xl hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition"
              >
                {generateLoading
                  ? "Generating Fair Contract..."
                  : "Generate My Contract"}
              </button>
            </div>

            {generatedContract && (
              <div className="bg-white rounded-3xl shadow-xl p-10">
                <h3 className="text-2xl font-bold mb-6">Generated Contract</h3>
                <div className="bg-gray-50 p-8 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap border max-h-[500px] overflow-auto">
                  {generatedContract}
                </div>

                <div className="mt-8 flex gap-4">
                  <button
                    onClick={downloadAsDocx}
                    className="flex-1 py-5 bg-blue-600 text-white font-semibold rounded-3xl hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Download size={20} /> Download as .docx
                  </button>
                  <button
                    onClick={downloadAsPdf}
                    className="flex-1 py-5 bg-red-600 text-white font-semibold rounded-3xl hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    <Download size={20} /> Download as PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Compare Documents Tab */}
        {activeTab === "compare" && (
          <div className="bg-white rounded-3xl shadow-xl p-10">
            <h2 className="text-3xl font-bold mb-8">Compare Two Contracts</h2>
            <p className="text-gray-600 mb-10">
              Upload two documents and get AI-powered comparison with
              suggestions
            </p>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-medium mb-3">
                  Document 1 (e.g. Your Version)
                </label>
                <input
                  type="file"
                  onChange={(e) => setFile1(e.target.files?.[0] || null)}
                  className="w-full"
                  accept=".pdf,.docx"
                />
                {file1 && (
                  <p className="mt-2 text-green-600 text-sm">
                    Selected: {file1.name}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-3">
                  Document 2 (e.g. Other Party's Version)
                </label>
                <input
                  type="file"
                  onChange={(e) => setFile2(e.target.files?.[0] || null)}
                  className="w-full"
                  accept=".pdf,.docx"
                />
                {file2 && (
                  <p className="mt-2 text-green-600 text-sm">
                    Selected: {file2.name}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={runComparison}
              disabled={!file1 || !file2 || compareLoading}
              className="mt-10 w-full py-6 bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold rounded-3xl disabled:opacity-50 transition"
            >
              {compareLoading
                ? "Analyzing Differences..."
                : "Compare Documents"}
            </button>

            {compareResult && (
              <div className="mt-12 bg-gray-50 p-8 rounded-2xl">
                <h3 className="font-bold text-xl mb-6">Comparison Result</h3>
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {compareResult.analysis}
                </div>
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
                    className={`max-w-[85%] px-4 py-3 rounded-3xl ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                    dangerouslySetInnerHTML={{
                      __html: msg.content
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\n/g, "<br>"),
                    }}
                  />
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
