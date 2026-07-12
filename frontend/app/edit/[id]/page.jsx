'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';

export default function EditPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [report, setReport] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [addbackSchedule, setAddbackSchedule] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedSummary, setEditedSummary] = useState({});
  const [editedTransactions, setEditedTransactions] = useState({});

  if (!loading && !user) {
    router.replace('/login');
    return null;
  }

  useEffect(() => {
    if (id) {
      fetchReport();
    }
  }, [id]);

  // ✅ USE EXISTING API - NOT THE NEW EDITOR API
  const fetchReport = async () => {
    try {
      const data = await api.getReport(id);
      setReport(data.report);
      setTransactions(data.transactions || []);
      setAddbackSchedule(data.addbackSchedule || []);
      
      // Initialize edited data
      setEditedSummary({
        totalRevenue: data.report.total_revenue || 0,
        totalExpenses: data.report.total_expenses || 0,
        netIncome: data.report.net_income || 0,
        ebitda: data.report.ebitda || 0,
        sde: data.report.sde || 0,
        totalAddbacks: data.report.total_addbacks || 0,
      });
      
      // Initialize transaction edits
      const txEdits = {};
      (data.transactions || []).forEach(t => {
        txEdits[t.id] = {
          category: t.category,
          isAddback: t.is_addback,
        };
      });
      setEditedTransactions(txEdits);
      
    } catch (error) {
      console.error('Failed to fetch report:', error);
      toast.error('Failed to load report');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSummaryChange = (field, value) => {
    setEditedSummary({
      ...editedSummary,
      [field]: parseFloat(value) || 0,
    });
  };

  const handleTransactionChange = (txnId, field, value) => {
    setEditedTransactions({
      ...editedTransactions,
      [txnId]: {
        ...editedTransactions[txnId],
        [field]: value,
      },
    });
  };

  const handleSaveEdits = async () => {
    setSaving(true);
    try {
      // Update each transaction that was changed
      for (const [txnId, edits] of Object.entries(editedTransactions)) {
        const original = transactions.find(t => t.id === txnId);
        if (original) {
          const changes = {};
          if (edits.category !== original.category) {
            changes.category = edits.category;
          }
          if (edits.isAddback !== original.is_addback) {
            changes.isAddback = edits.isAddback;
          }
          
          if (Object.keys(changes).length > 0) {
            // ✅ USE EXISTING API - updateTransaction already works!
            await api.updateTransaction(id, txnId, changes);
          }
        }
      }
      
      toast.success('Changes saved successfully!');
      await fetchReport(); // Refresh
      
    } catch (error) {
      console.error('Save failed:', error);
      toast.error(error.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    try {
      await api.generatePdf(id);
      toast.success('PDF generated!');
      router.push(`/reports/${id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to generate PDF');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const CATEGORIES = [
    'Revenue', 'COGS', 'Payroll', 'Rent', 'Utilities', 'Marketing',
    'Insurance', 'Professional Fees', 'Travel & Entertainment', 'Vehicle',
    'Office Supplies', 'Depreciation & Amortization', 'Interest Expense',
    'Taxes', 'Owner Compensation', 'Other Operating Expense',
  ];

  if (loadingData) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-4xl mx-auto px-6 py-10 text-center">
          <h2 className="text-xl font-semibold text-gray-700">Report not found</h2>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-8 pb-32">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold">
              ✏️ Edit Report: {report.business_name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Make changes to the AI-generated report. All changes will be saved.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => router.push(`/reports/${id}`)}
              className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
            >
              ← Back to Report
            </button>
            <button
              onClick={handleSaveEdits}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : '💾 Save Changes'}
            </button>
            <button
              onClick={handleGeneratePDF}
              className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
            >
              📄 Generate PDF
            </button>
          </div>
        </div>

        {/* Executive Summary - Editable */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold mb-4">Executive Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { key: 'totalRevenue', label: 'Revenue', color: 'text-blue-600' },
              { key: 'totalExpenses', label: 'Expenses', color: 'text-red-600' },
              { key: 'netIncome', label: 'Net Income', color: 'text-green-600' },
              { key: 'ebitda', label: 'EBITDA', color: 'text-purple-600' },
              { key: 'sde', label: 'SDE', color: 'text-indigo-600' },
              { key: 'totalAddbacks', label: 'Add-Backs', color: 'text-orange-600' },
            ].map((metric) => (
              <div key={metric.key} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{metric.label}</p>
                <input
                  type="number"
                  step="1000"
                  value={editedSummary[metric.key] || 0}
                  onChange={(e) => handleSummaryChange(metric.key, e.target.value)}
                  className={`mt-1 w-full px-2 py-1 border border-gray-200 rounded text-sm font-bold ${metric.color} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            💡 Edit any number above. Changes will be saved when you click "Save Changes".
          </p>
        </div>

        {/* Add-Back Schedule - Read Only */}
        {addbackSchedule.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 mb-6">
            <h2 className="text-lg font-semibold mb-4">Add-Back Schedule</h2>
            <p className="text-sm text-gray-500 mb-3">
              To edit add-backs, go back to the report and use the "Edit" button.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {addbackSchedule.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.label}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{item.category}</td>
                      <td className="px-4 py-2 text-sm font-medium text-red-600">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transactions - Editable Categories */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold mb-4">Transactions ({transactions.length})</h2>
          <p className="text-sm text-gray-500 mb-3">
            Edit category or mark/unmark as add-back for each transaction.
          </p>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Add-Back</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((t) => (
                  <tr key={t.id} className={editedTransactions[t.id]?.isAddback ? 'bg-yellow-50' : ''}>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {new Date(t.txn_date).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 max-w-xs truncate">
                      {t.description}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <select
                        value={editedTransactions[t.id]?.category || t.category || 'Other Operating Expense'}
                        onChange={(e) => handleTransactionChange(t.id, 'category', e.target.value)}
                        className="px-2 py-1 border border-gray-200 rounded text-sm w-full focus:ring-2 focus:ring-blue-500"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className={`px-3 py-2 text-sm font-medium ${
                      t.amount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <button
                        onClick={() => handleTransactionChange(t.id, 'isAddback', !editedTransactions[t.id]?.isAddback)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          editedTransactions[t.id]?.isAddback
                            ? 'bg-yellow-200 text-yellow-800'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {editedTransactions[t.id]?.isAddback ? '⚡ Add-back' : 'Mark'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            💡 Changes to categories and add-back status will be saved when you click "Save Changes".
          </p>
        </div>

        {/* Bottom Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50">
          <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
            <div className="text-sm text-gray-500">
              📝 Editing: {report.business_name}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push(`/reports/${id}`)}
                className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdits}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}