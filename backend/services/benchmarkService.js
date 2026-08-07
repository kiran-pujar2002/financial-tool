// services/benchmarkService.js
const { query } = require('../config/db');

// ============================================================
// Get industry benchmarks
// ============================================================
async function getBenchmarks(industry) {
    let result;
    if (industry) {
        result = await query(
            `SELECT * FROM industry_benchmarks 
             WHERE industry ILIKE $1 OR sub_industry ILIKE $1`,
            [`%${industry}%`]
        );
    } else {
        result = await query(
            'SELECT * FROM industry_benchmarks ORDER BY industry'
        );
    }
    
    return result.rows;
}

// ============================================================
// Compare report against industry benchmarks
// ============================================================
async function compareReport(reportId, userId) {
    // 1. Get report data
    const reportResult = await query(
        `SELECT id, business_name, industry, total_revenue, 
                ebitda, sde, total_addbacks, period_start, period_end
         FROM reports WHERE id = $1 AND user_id = $2`,
        [reportId, userId]
    );
    
    if (reportResult.rows.length === 0) {
        throw new Error('Report not found');
    }
    
    const report = reportResult.rows[0];
    
    // 2. Get industry benchmarks
    const benchmarks = await getBenchmarks(report.industry);
    
    if (benchmarks.length === 0) {
        return {
            report,
            benchmarks: null,
            comparison: null,
            message: 'No benchmarks available for this industry'
        };
    }
    
    const benchmark = benchmarks[0];
    
    // 3. Calculate report metrics
    const totalRevenue = Number(report.total_revenue) || 0;
    const ebitda = Number(report.ebitda) || 0;
    const sde = Number(report.sde) || 0;
    const totalAddbacks = Number(report.total_addbacks) || 0;
    
    const ebitdaMargin = totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0;
    const sdeMargin = totalRevenue > 0 ? (sde / totalRevenue) * 100 : 0;
    const addbackPercentage = totalRevenue > 0 ? (totalAddbacks / totalRevenue) * 100 : 0;
    
    // 4. Compare against benchmarks
    const comparison = {
        revenue: compareValue(totalRevenue, benchmark.revenue_multiple_mid * 1000000, 'revenue'),
        ebitda: compareValue(ebitda, benchmark.ebitda_multiple_mid * 1000000, 'ebitda'),
        sde: compareValue(sde, benchmark.sde_multiple_mid * 1000000, 'sde'),
        ebitdaMargin: compareValue(ebitdaMargin, benchmark.ebitda_margin_avg, 'margin'),
        sdeMargin: compareValue(sdeMargin, benchmark.sde_margin_avg, 'margin'),
        addbackPercentage: compareValue(addbackPercentage, 5.0, 'percentage'),
    };
    
    // 5. Generate insights
    const insights = generateInsights(report, benchmark, comparison);
    
    // 6. Save comparison
    await saveComparison(reportId, userId, { comparison, insights, benchmark });
    
    return {
        report,
        benchmark,
        comparison,
        insights,
        percentiles: calculatePercentiles(report, benchmark)
    };
}

// ============================================================
// Compare two values
// ============================================================
function compareValue(actual, benchmark, type) {
    if (!benchmark || benchmark === 0) {
        return { actual, benchmark: null, status: 'unknown', percentage: 0 };
    }
    
    const percentage = ((actual - benchmark) / benchmark) * 100;
    let status = 'average';
    
    if (type === 'margin' || type === 'percentage') {
        // Higher is better for margins and percentages
        if (percentage > 15) status = 'excellent';
        else if (percentage > 5) status = 'good';
        else if (percentage < -15) status = 'poor';
        else if (percentage < -5) status = 'below_average';
    } else if (type === 'revenue' || type === 'ebitda' || type === 'sde') {
        // Higher is generally better for revenue and earnings
        if (percentage > 20) status = 'excellent';
        else if (percentage > 10) status = 'good';
        else if (percentage < -20) status = 'poor';
        else if (percentage < -10) status = 'below_average';
    }
    
    return {
        actual: Math.round(actual * 100) / 100,
        benchmark: Math.round(benchmark * 100) / 100,
        status,
        percentage: Math.round(percentage * 100) / 100
    };
}

// ============================================================
// Generate insights
// ============================================================
function generateInsights(report, benchmark, comparison) {
    const insights = [];
    
    // Revenue insight
    if (comparison.revenue.status === 'excellent') {
        insights.push({
            type: 'strength',
            category: 'revenue',
            message: `${report.business_name} has significantly higher revenue than industry average`,
            icon: '📈'
        });
    } else if (comparison.revenue.status === 'poor') {
        insights.push({
            type: 'opportunity',
            category: 'revenue',
            message: `${report.business_name} revenue is below industry average - potential for growth`,
            icon: '📊'
        });
    }
    
    // EBITDA margin insight
    if (comparison.ebitdaMargin.status === 'excellent') {
        insights.push({
            type: 'strength',
            category: 'profitability',
            message: `EBITDA margin is ${Math.abs(comparison.ebitdaMargin.percentage).toFixed(0)}% above industry average - strong profitability`,
            icon: '💰'
        });
    } else if (comparison.ebitdaMargin.status === 'poor') {
        insights.push({
            type: 'warning',
            category: 'profitability',
            message: `EBITDA margin is below industry average - consider cost optimization`,
            icon: '⚠️'
        });
    }
    
    // SDE insight
    if (comparison.sde.status === 'excellent') {
        insights.push({
            type: 'strength',
            category: 'valuation',
            message: `SDE is above industry average - strong valuation foundation`,
            icon: '🏆'
        });
    }
    
    // Add-backs insight
    if (comparison.addbackPercentage > 10) {
        insights.push({
            type: 'warning',
            category: 'addbacks',
            message: `High add-backs (${comparison.addbackPercentage.actual.toFixed(0)}% of revenue) - ensure all are justified`,
            icon: '🔍'
        });
    }
    
    // Multiple suggestion
    const suggestedMultiple = benchmark.sde_multiple_mid;
    insights.push({
        type: 'recommendation',
        category: 'valuation',
        message: `Industry SDE multiple is ${suggestedMultiple}x. Consider this for valuation benchmarking.`,
        icon: '💡'
    });
    
    return insights;
}

// ============================================================
// Calculate percentiles (simplified)
// ============================================================
function calculatePercentiles(report, benchmark) {
    const totalRevenue = Number(report.total_revenue) || 0;
    const ebitda = Number(report.ebitda) || 0;
    const sde = Number(report.sde) || 0;
    
    const ebitdaMargin = totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0;
    const sdeMargin = totalRevenue > 0 ? (sde / totalRevenue) * 100 : 0;
    
    // Simplified percentile calculation based on benchmark ranges
    const getPercentile = (value, min, mid, max) => {
        if (value >= max) return 90 + Math.random() * 10;
        if (value >= mid) return 50 + ((value - mid) / (max - mid)) * 40;
        if (value >= min) return 10 + ((value - min) / (mid - min)) * 40;
        return Math.random() * 10;
    };
    
    return {
        revenue: Math.round(getPercentile(totalRevenue, 1000000, 5000000, 10000000)),
        ebitda: Math.round(getPercentile(ebitda, 50000, 500000, 2000000)),
        sde: Math.round(getPercentile(sde, 100000, 1000000, 3000000)),
        ebitdaMargin: Math.round(getPercentile(ebitdaMargin, 5, 15, 30)),
        sdeMargin: Math.round(getPercentile(sdeMargin, 8, 20, 35))
    };
}

// ============================================================
// Save comparison
// ============================================================
async function saveComparison(reportId, userId, data) {
    const existing = await query(
        'SELECT id FROM peer_comparisons WHERE report_id = $1 AND user_id = $2',
        [reportId, userId]
    );
    
    if (existing.rows.length > 0) {
        await query(
            `UPDATE peer_comparisons 
             SET comparison_data = $1, updated_at = now()
             WHERE id = $2`,
            [JSON.stringify(data), existing.rows[0].id]
        );
    } else {
        await query(
            `INSERT INTO peer_comparisons (report_id, user_id, comparison_data)
             VALUES ($1, $2, $3)`,
            [reportId, userId, JSON.stringify(data)]
        );
    }
}

module.exports = {
    getBenchmarks,
    compareReport,
};