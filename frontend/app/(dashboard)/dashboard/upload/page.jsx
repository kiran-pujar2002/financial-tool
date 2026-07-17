'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { 
  Upload, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle,
  ArrowRight,
  Calendar,
  Building2,
  Briefcase,
  Download,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Landmark,
  File,
  X
} from 'lucide-react';

// ✅ Allowed file types
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export default function UploadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showFileSource, setShowFileSource] = useState(false);

  if (!loading && !user) {
    router.replace('/login');
    return null;
  }

  // ✅ Validate file
  const validateFile = (selectedFile) => {
    // Check if file exists
    if (!selectedFile) {
      setFileError('Please select a file');
      return false;
    }

    // Check file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setFileError(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
      return false;
    }

    // Check file extension
    const extension = '.' + selectedFile.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setFileError(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return false;
    }

    setFileError(null);
    return true;
  };

  // ✅ Handle file selection
  const handleFileSelect = (selectedFile) => {
    if (validateFile(selectedFile)) {
      setFile(selectedFile);
      setError(null);
    } else {
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ✅ Handle file removal
  const handleRemoveFile = (e) => {
    e.stopPropagation();
    setFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      handleFileSelect(dropped);
    }
  }

  // ✅ Download sample file
  const downloadSampleFile = () => {
    const sampleData = `Date,Description,Category,Amount
2025-01-05,Square Payments Inc - Retail Sales,Revenue,18420
2025-01-10,ABC Hardware Distributors LLC,COGS,-19210
2025-01-15,Gusto Payroll - Staff Wages,Payroll,-6500
2025-01-15,Westgate Properties - Store Rent,Rent,-13200
2025-01-18,Pacific Gas & Electric,Utilities,-1410
2025-01-20,Facebook Ads - Store Promotion,Marketing,-1350
2025-01-22,State Farm - Business Insurance,Insurance,-280
2025-01-25,Owner's personal Tesla lease payment,Vehicle,-11150
2025-01-28,Smith & Associates - Legal Fees,Professional Fees,-600
2025-02-05,Square Payments Inc - Retail Sales,Revenue,19850
2025-02-10,ABC Hardware Distributors LLC,COGS,-19800
2025-02-15,Westgate Properties - Store Rent,Rent,-13200
2025-02-15,Gusto Payroll - Staff Wages,Payroll,-6500
2025-02-18,Pacific Gas & Electric,Utilities,-1395
2025-02-20,Facebook Ads - Store Promotion,Marketing,-1350
2025-02-22,State Farm - Business Insurance,Insurance,-280
2025-02-25,Owner's personal Tesla lease payment,Vehicle,-11150
2025-02-28,Delta Airlines - Owner personal Cancun Trip,Travel & Entertainment,-12400
2025-03-05,Square Payments Inc - Retail Sales,Revenue,21100
2025-03-10,ABC Hardware Distributors LLC,COGS,-10500
2025-03-15,Westgate Properties - Store Rent,Rent,-13200
2025-03-15,Gusto Payroll - J. Smith (owner's son),Owner Compensation,-13200
2025-03-15,Gusto Payroll - Staff Wages,Payroll,-6500
2025-03-18,Pacific Gas & Electric,Utilities,-1420
2025-03-20,Facebook Ads - Store Promotion,Marketing,-1400
2025-03-22,State Farm - Business Insurance,Insurance,-280
2025-03-25,Owner's personal Tesla lease payment,Vehicle,-11150
2025-03-28,Home Depot - Store Fixtures,Other Operating Expense,-1890
2025-04-05,Square Payments Inc - Retail Sales,Revenue,22300
2025-04-10,ABC Hardware Distributors LLC,COGS,-11200
2025-04-15,Gusto Payroll - Staff Wages,Payroll,-6800
2025-04-15,Westgate Properties - Store Rent,Rent,-13200`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample-profit-loss.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    // ✅ Validate file before submission
    if (!file) {
      setError('Please select a financial statement file (CSV or Excel).');
      return;
    }

    if (!validateFile(file)) {
      setError(fileError || 'Invalid file. Please check the file format.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('businessName', businessName);
    if (industry) formData.append('industry', industry);
    if (periodStart) formData.append('periodStart', periodStart);
    if (periodEnd) formData.append('periodEnd', periodEnd);

    setSubmitting(true);
    try {
      const { report } = await api.uploadReport(formData);
      router.push(`/reports/${report.id}`);
    } catch (err) {
      // ✅ Check if it's a validation error from backend
      const errorMsg = err instanceof ApiError ? err.message : 'Upload failed. Please try again.';
      
      // Check for specific error types
      if (errorMsg.includes('Invalid financial file')) {
        setError('The uploaded file doesn\'t appear to be a valid financial statement. Please ensure you\'re uploading a CSV or Excel file with columns for Date, Description, and Amount.');
      } else if (errorMsg.includes('2000 transactions')) {
        setError('File has too many transactions. Please split into smaller periods (max 2000 transactions per report).');
      } else if (errorMsg.includes('minimum 3')) {
        setError('File contains too few transactions. Minimum 3 transactions required.');
      } else {
        setError(errorMsg);
      }
      setSubmitting(false);
    }
  }

  // ✅ Get file size in readable format
  const getFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // ✅ File Source Helper Component
  const FileSourceHelper = () => {
    const sources = [
      {
        icon: <Building2 size={16} />,
        name: 'Accounting Software',
        items: ['QuickBooks → Export P&L', 'Xero → Reports → P&L', 'Tally → Gateway → P&L', 'Zoho Books → Reports'],
      },
      {
        icon: <Landmark size={16} />,
        name: 'Banking Platforms',
        items: ['Download transaction history as CSV/Excel'],
      },
      {
        icon: <FileSpreadsheet size={16} />,
        name: 'Other Sources',
        items: ['Bookkeeper/Accountant exports', 'ERP systems (SAP, Oracle)', 'Custom Excel spreadsheets'],
      },
    ];

    return (
      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
        <button
          onClick={() => setShowFileSource(!showFileSource)}
          className="w-full flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 transition"
        >
          {showFileSource ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <HelpCircle size={16} />
          Where can I get a financial statement file?
        </button>

        {showFileSource && (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-slate-600">
              Your financial statement file can be exported from:
            </p>
            
            {sources.map((source, idx) => (
              <div key={idx} className="bg-white rounded-lg p-3 border border-blue-100">
                <div className="flex items-center gap-2 font-medium text-slate-700">
                  {source.icon}
                  {source.name}
                </div>
                <ul className="mt-1 ml-6 space-y-0.5">
                  {source.items.map((item, i) => (
                    <li key={i} className="text-sm text-slate-500 list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="text-xs text-slate-400 mt-2">
              <strong>Tip:</strong> Look for a CSV or Excel export option in your accounting software.
              The file should have columns like: Date, Description, Amount.
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-8">
        {/* Header */}
        <div className=" mb-4 sm:mb-4">
          {/* <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg mb-4">
            <FileSpreadsheet className="text-white" size={28} />
          </div> */}
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">New Report</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-2">
              Upload a CSV or Excel export of the business&apos;s P&amp;L. We&apos;ll categorize every line item and flag likely add-backs automatically.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Business Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="businessName">
                <Building2 size={16} className="inline mr-1.5 text-indigo-500" />
                Business name
              </label>
              <input
                id="businessName"
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                placeholder="Acme Hardware LLC"
              />
            </div>

            {/* Industry */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="industry">
                <Briefcase size={16} className="inline mr-1.5 text-indigo-500" />
                Industry (optional)
              </label>
              <input
                id="industry"
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                placeholder="Retail / Hardware"
              />
            </div>

            {/* Period Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="periodStart">
                  <Calendar size={16} className="inline mr-1.5 text-indigo-500" />
                  Period start (optional)
                </label>
                <input
                  id="periodStart"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="periodEnd">
                  <Calendar size={16} className="inline mr-1.5 text-indigo-500" />
                  Period end (optional)
                </label>
                <input
                  id="periodEnd"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            {/* File Upload */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Financial statement
                </label>
                <button
                  type="button"
                  onClick={downloadSampleFile}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  <Download size={14} />
                  Download Sample
                </button>
              </div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl px-6 py-10 text-center cursor-pointer transition-all duration-200 ${
                  dragActive 
                    ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' 
                    : file 
                      ? 'border-emerald-500 bg-emerald-50/50' 
                      : fileError 
                        ? 'border-red-500 bg-red-50/50'
                        : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) {
                      handleFileSelect(selectedFile);
                    }
                  }}
                />
                
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle className="text-emerald-600" size={24} />
                    </div>
                    <p className="text-sm font-semibold text-emerald-700">{file.name}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>📊 {getFileSize(file.size)}</span>
                      <span className="text-slate-300">|</span>
                      <button 
                        onClick={handleRemoveFile}
                        className="text-red-500 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-full ${fileError ? 'bg-red-100' : 'bg-indigo-100'} flex items-center justify-center`}>
                      {fileError ? (
                        <AlertCircle className="text-red-600" size={24} />
                      ) : (
                        <Upload className="text-indigo-600" size={24} />
                      )}
                    </div>
                    {fileError ? (
                      <>
                        <p className="text-sm font-medium text-red-700">{fileError}</p>
                        <p className="text-xs text-red-500">Click to select a valid file</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-slate-700">Drag and drop, or click to browse</p>
                        <p className="text-xs text-slate-500">CSV or Excel (.xlsx, .xls), up to 25MB</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* File Source Helper */}
            <FileSourceHelper />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !file || !!fileError}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl py-3.5 text-sm font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading…
                </>
              ) : (
                <>
                  Upload and analyze
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Trust Indicators */}
        <div className="mt-8 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="text-xs font-medium text-slate-600">AI Powered</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Smart categorization</p>
          </div>
          <div className="text-center">
            <div className="text-xs font-medium text-slate-600">Secure</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Encrypted uploads</p>
          </div>
          <div className="text-center">
            <div className="text-xs font-medium text-slate-600">Fast</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Results in minutes</p>
          </div>
        </div>
      </main>
    </div>
  );
}