'use client';

import { useState, useCallback, useMemo } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Filter,
  Edit2,
  Save,
  X,
  Check,
  AlertCircle
} from 'lucide-react';

const DEFAULT_CATEGORIES = [
  'Revenue', 'COGS', 'Payroll', 'Rent', 'Utilities', 'Marketing',
  'Insurance', 'Professional Fees', 'Travel & Entertainment', 'Vehicle',
  'Office Supplies', 'Depreciation & Amortization', 'Interest Expense',
  'Taxes', 'Owner Compensation', 'Other Operating Expense', 'Non-Operating',
];

export function TransactionGrid({ 
  transactions = [], 
  onUpdate, 
  onBulkUpdate,
  customCategories = [],
  isCompleted = false,
  isProcessing = false
}) {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterAddback, setFilterAddback] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories.map(c => c.name)];

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
    
    // Search
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filter by category
    if (filterCategory !== 'all') {
      filtered = filtered.filter(t => t.category === filterCategory);
    }
    
    // Filter by addback
    if (filterAddback === 'addback') {
      filtered = filtered.filter(t => t.is_addback);
    } else if (filterAddback === 'non-addback') {
      filtered = filtered.filter(t => !t.is_addback);
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === 'amount') {
        aVal = Math.abs(aVal);
        bVal = Math.abs(bVal);
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  }, [transactions, searchTerm, filterCategory, filterAddback, sortField, sortDirection]);

  // Handle inline edit
  const startEdit = (transaction) => {
    setEditingId(transaction.id);
    setEditData({
      category: transaction.category,
      is_addback: transaction.is_addback,
      addback_reason: transaction.addback_reason || '',
      editor_notes: transaction.editor_notes || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = (id) => {
    onUpdate(id, editData);
    setEditingId(null);
    setEditData({});
  };

  // Handle bulk selection
  const toggleSelect = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  // Handle bulk action
  const handleBulkCategoryChange = (category) => {
    if (selectedIds.size === 0) return;
    
    const updates = Array.from(selectedIds).map(id => ({
      id,
      category,
      is_manually_edited: true,
    }));
    
    onBulkUpdate(updates);
    setSelectedIds(new Set());
  };

  const handleBulkAddbackToggle = (value) => {
    if (selectedIds.size === 0) return;
    
    const updates = Array.from(selectedIds).map(id => ({
      id,
      is_addback: value,
    }));
    
    onBulkUpdate(updates);
    setSelectedIds(new Set());
  };

  // Format currency
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '—';
    return Number(value).toLocaleString('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      maximumFractionDigits: 0 
    });
  };

  if (isProcessing) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin mx-auto"></div>
        <p className="mt-4 text-slate-500">Loading transactions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Categories</option>
            {allCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          
          <select
            value={filterAddback}
            onChange={(e) => setFilterAddback(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Transactions</option>
            <option value="addback">Add-backs Only</option>
            <option value="non-addback">Non-Add-backs</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-indigo-700">
            {selectedIds.size} selected
          </span>
          <span className="text-slate-300">|</span>
          <select
            onChange={(e) => handleBulkCategoryChange(e.target.value)}
            className="px-3 py-1.5 border border-indigo-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Change Category...</option>
            {allCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            onClick={() => handleBulkAddbackToggle(true)}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition"
          >
            Mark as Add-back
          </button>
          <button
            onClick={() => handleBulkAddbackToggle(false)}
            className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300 transition"
          >
            Remove Add-back
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 text-slate-500 hover:text-slate-700 transition"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    disabled={isCompleted}
                  />
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:text-slate-900"
                  onClick={() => {
                    if (sortField === 'date') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('date');
                      setSortDirection('desc');
                    }
                  }}
                >
                  Date
                  {sortField === 'date' && (sortDirection === 'asc' ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />)}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:text-slate-900"
                  onClick={() => {
                    if (sortField === 'category') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('category');
                      setSortDirection('asc');
                    }
                  }}
                >
                  Category
                  {sortField === 'category' && (sortDirection === 'asc' ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />)}
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:text-slate-900"
                  onClick={() => {
                    if (sortField === 'amount') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('amount');
                      setSortDirection('desc');
                    }
                  }}
                >
                  Amount
                  {sortField === 'amount' && (sortDirection === 'asc' ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />)}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Add-back</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => {
                  const isEditing = editingId === t.id;
                  const isSelected = selectedIds.has(t.id);
                  
                  return (
                    <tr 
                      key={t.id} 
                      className={`${t.is_addback ? 'bg-indigo-50/30' : ''} ${isSelected ? 'bg-indigo-50' : ''} hover:bg-slate-50 transition`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(t.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          disabled={isCompleted}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {t.txn_date ? new Date(t.txn_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-900 max-w-xs truncate">
                        {t.description}
                        {t.editor_notes && (
                          <span className="ml-2 text-xs text-slate-400" title={t.editor_notes}>
                            <AlertCircle size={12} className="inline" />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={editData.category}
                            onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                            className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          >
                            {allCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`text-sm px-2 py-1 rounded-lg ${
                            t.is_manually_edited ? 'bg-indigo-100 text-indigo-700' : ''
                          }`}>
                            {t.category}
                            {t.is_manually_edited && (
                              <span className="ml-1 text-xs text-indigo-500" title="Manually edited">✏️</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(t.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={editData.is_addback}
                            onChange={(e) => setEditData({ ...editData, is_addback: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        ) : (
                          <input
                            type="checkbox"
                            checked={t.is_addback}
                            onChange={() => onUpdate(t.id, { is_addback: !t.is_addback })}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            disabled={isCompleted}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => saveEdit(t.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(t)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            disabled={isCompleted}
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{filteredTransactions.length} of {transactions.length} transactions</span>
        <span>
          {transactions.filter(t => t.is_addback).length} add-backs flagged
          {transactions.filter(t => t.is_manually_edited).length > 0 && 
            ` · ${transactions.filter(t => t.is_manually_edited).length} manually edited`
          }
        </span>
      </div>
    </div>
  );
}