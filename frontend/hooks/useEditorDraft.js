'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export function useEditorDraft(reportId) {
  const [transactions, setTransactions] = useState([]);
  const [addbacks, setAddbacks] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState(null);
  
  const saveTimeoutRef = useRef(null);
  const isDirtyRef = useRef(false);

  // Load editor data
  const loadDraft = useCallback(async () => {
    if (!reportId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await api.getEditorDraft(reportId);
      setReport(data.report);
      setTransactions(data.transactions);
      setAddbacks(data.addbackSchedule);
      setCustomCategories(data.customCategories || []);
      
      if (data.draft) {
        setVersion(data.draft.version);
        setLastSaved(new Date(data.draft.savedAt));
        // Apply draft data if needed
        if (data.draft.data.transactions) {
          setTransactions(data.draft.data.transactions);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load report data');
      toast.error('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  }, [reportId]);

  // Auto-save draft
  const saveDraft = useCallback(async (comment = null) => {
    if (!reportId || !isDirtyRef.current) return;
    
    setIsSaving(true);
    
    try {
      const draftData = {
        transactions,
        addbacks,
        version: version + 1,
        savedAt: new Date().toISOString(),
      };
      
      const result = await api.saveEditorDraft(reportId, draftData, comment);
      setVersion(result.version);
      setLastSaved(new Date(result.savedAt));
      isDirtyRef.current = false;
      
      toast.success('Draft saved');
    } catch (err) {
      toast.error('Failed to save draft');
      console.error('Save draft error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [reportId, transactions, addbacks, version]);

  // Debounced save
  const debouncedSave = useCallback((comment = null) => {
    isDirtyRef.current = true;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft(comment);
    }, 2000);
  }, [saveDraft]);

  // Update transaction
  const updateTransaction = useCallback(async (id, updates) => {
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return;
    
    const updated = [...transactions];
    updated[index] = { ...updated[index], ...updates };
    setTransactions(updated);
    
    // Trigger auto-save
    debouncedSave(`Updated transaction ${id}`);
    
    // Also update backend immediately for critical updates
    try {
      await api.bulkUpdateTransactions(reportId, [{
        id,
        category: updates.category,
        isAddback: updates.is_addback,
        addbackReason: updates.addback_reason,
        editorNotes: updates.editor_notes,
      }]);
    } catch (err) {
      toast.error('Failed to update transaction');
      // Revert on error
      setTransactions(transactions);
    }
  }, [transactions, reportId, debouncedSave]);

  // Bulk update transactions
  const bulkUpdate = useCallback(async (updates) => {
    const updated = [...transactions];
    const updateMap = new Map(updates.map(u => [u.id, u]));
    
    for (let i = 0; i < updated.length; i++) {
      const update = updateMap.get(updated[i].id);
      if (update) {
        updated[i] = { ...updated[i], ...update };
      }
    }
    
    setTransactions(updated);
    isDirtyRef.current = true;
    
    try {
      const result = await api.bulkUpdateTransactions(reportId, updates);
      setAddbacks(result.addbackSchedule);
      // Update metrics if returned
      if (result.metrics) {
        setReport(prev => ({ ...prev, ...result.metrics }));
      }
      toast.success(`${updates.length} transactions updated`);
    } catch (err) {
      toast.error('Failed to update transactions');
      // Revert
      setTransactions(transactions);
    }
  }, [transactions, reportId]);

  // Add custom category
  const addCustomCategory = useCallback(async (name, color) => {
    try {
      const result = await api.createCustomCategory(name, color);
      setCustomCategories(prev => [...prev, result.category]);
      toast.success(`Category "${name}" created`);
      return result.category;
    } catch (err) {
      toast.error('Failed to create category');
      throw err;
    }
  }, []);

  // Delete custom category
  const deleteCustomCategory = useCallback(async (id) => {
    try {
      await api.deleteCustomCategory(id);
      setCustomCategories(prev => prev.filter(c => c.id !== id));
      toast.success('Category deleted');
    } catch (err) {
      toast.error('Failed to delete category');
      throw err;
    }
  }, []);

  // Save and finalize
  const finalizeReport = useCallback(async () => {
    try {
      await saveDraft('Finalizing report');
      const result = await api.finalizeReport(reportId, { transactions, addbacks });
      toast.success('Report finalized! Ready for payment.');
      return result;
    } catch (err) {
      toast.error('Failed to finalize report');
      throw err;
    }
  }, [reportId, transactions, addbacks, saveDraft]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Save on unmount if dirty
        if (isDirtyRef.current) {
          saveDraft('Auto-save before leaving');
        }
      }
    };
  }, [saveDraft]);

  // Load initial data
  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  return {
    report,
    transactions,
    addbacks,
    customCategories,
    isLoading,
    isSaving,
    lastSaved,
    version,
    error,
    updateTransaction,
    bulkUpdate,
    saveDraft,
    debouncedSave,
    addCustomCategory,
    deleteCustomCategory,
    finalizeReport,
    reload: loadDraft,
  };
}