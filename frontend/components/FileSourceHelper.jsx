'use client';

import { useState } from 'react';
import { 
    ChevronDown, 
    ChevronRight, 
    Building2, 
    Landmark, 
    FileSpreadsheet,
    BookOpen,
    HelpCircle
} from 'lucide-react';

export default function FileSourceHelper() {
    const [isExpanded, setIsExpanded] = useState(false);

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
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mt-4">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 transition"
            >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <HelpCircle size={16} />
                Where can I get a financial statement file?
            </button>

            {isExpanded && (
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
}