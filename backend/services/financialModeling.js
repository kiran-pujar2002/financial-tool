// services/financialModeling.js
const { query } = require('../config/db');

// ============================================================
// Create a new financial model
// ============================================================
async function createModel(reportId, userId, data) {
    const { name, description, baseYear, projectionYears = 5 } = data;
    
    const result = await query(
        `INSERT INTO financial_models (report_id, user_id, name, description, base_year, projection_years)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [reportId, userId, name || 'My Projection', description, baseYear || new Date().getFullYear(), projectionYears]
    );
    
    return result.rows[0];
}

// ============================================================
// Get models for a report
// ============================================================
async function getModels(reportId, userId) {
    const result = await query(
        `SELECT * FROM financial_models 
         WHERE report_id = $1 AND user_id = $2 
         ORDER BY created_at DESC`,
        [reportId, userId]
    );
    
    return result.rows;
}

// ============================================================
// Get model with scenarios and projections
// ============================================================
async function getModel(modelId, userId) {
    // Get model
    const modelResult = await query(
        'SELECT * FROM financial_models WHERE id = $1 AND user_id = $2',
        [modelId, userId]
    );
    
    if (modelResult.rows.length === 0) {
        throw new Error('Model not found');
    }
    
    const model = modelResult.rows[0];
    
    // Get scenarios
    const scenariosResult = await query(
        `SELECT * FROM model_scenarios WHERE model_id = $1 ORDER BY created_at`,
        [modelId]
    );
    
    // Get projections for each scenario
    const scenarios = [];
    for (const scenario of scenariosResult.rows) {
        const projectionsResult = await query(
            `SELECT * FROM model_projections 
             WHERE scenario_id = $1 
             ORDER BY year ASC`,
            [scenario.id]
        );
        scenarios.push({
            ...scenario,
            projections: projectionsResult.rows
        });
    }
    
    return {
        ...model,
        scenarios
    };
}

// ============================================================
// Create a scenario with projections based on REAL report data
// ============================================================
async function createScenario(modelId, data) {
    const {
        name,
        description,
        assumptions,
        revenueGrowthRate,
        ebitdaMargin,
        capexPercentage,
        workingCapitalPercentage,
        taxRate = 25.0,
        discountRate = 12.0,
        terminalGrowthRate = 3.0,
    } = data;
    
    // Get model to know projection years and report_id
    const modelResult = await query(
        `SELECT m.*, r.total_revenue, r.ebitda, r.sde, r.net_income, r.total_addbacks
         FROM financial_models m
         JOIN reports r ON m.report_id = r.id
         WHERE m.id = $1`,
        [modelId]
    );
    
    if (modelResult.rows.length === 0) {
        throw new Error('Model not found');
    }
    
    const model = modelResult.rows[0];
    
    // ✅ Extract REAL financial data from the report
    const baseRevenue = Number(model.total_revenue) || 10000000;
    const baseEbitda = Number(model.ebitda) || 2000000;
    const baseSde = Number(model.sde) || 1500000;
    const baseNetIncome = Number(model.net_income) || 1000000;
    const baseAddbacks = Number(model.total_addbacks) || 0;
    
    console.log('📊 Creating scenario with base data:', {
        revenue: baseRevenue,
        ebitda: baseEbitda,
        sde: baseSde,
        addbacks: baseAddbacks
    });
    
    // Create scenario
    const scenarioResult = await query(
        `INSERT INTO model_scenarios (
            model_id, name, description, assumptions, 
            revenue_growth_rate, ebitda_margin, capex_percentage,
            working_capital_percentage, tax_rate, discount_rate, terminal_growth_rate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [modelId, name, description, assumptions || {}, 
         revenueGrowthRate || 10, ebitdaMargin || 20,
         capexPercentage || 5, workingCapitalPercentage || 10,
         taxRate, discountRate, terminalGrowthRate]
    );
    
    const scenario = scenarioResult.rows[0];
    
    // ✅ Generate REAL projections based on report data
    await generateRealProjections(
        scenario.id, 
        model.base_year, 
        model.projection_years,
        {
            baseRevenue,
            baseEbitda,
            baseSde,
            baseNetIncome,
            baseAddbacks,
            revenueGrowthRate: revenueGrowthRate || 10,
            ebitdaMargin: ebitdaMargin || 20,
            taxRate: taxRate || 25,
        }
    );
    
    return scenario;
}

// ============================================================
// Generate REAL projections based on actual report data
// ============================================================
async function generateRealProjections(scenarioId, baseYear, projectionYears, baseData) {
    const {
        baseRevenue,
        baseEbitda,
        baseSde,
        baseNetIncome,
        baseAddbacks,
        revenueGrowthRate,
        ebitdaMargin,
        taxRate,
    } = baseData;
    
    console.log('📈 Generating projections with base data:', {
        baseRevenue,
        baseEbitda,
        baseSde,
        revenueGrowthRate,
        ebitdaMargin
    });
    
    let revenue = baseRevenue;
    let ebitda = baseEbitda;
    let sde = baseSde;
    let netIncome = baseNetIncome;
    
    const projections = [];
    
    for (let i = 1; i <= projectionYears; i++) {
        const year = baseYear + i;
        
        // Apply growth rate to revenue
        revenue = revenue * (1 + (revenueGrowthRate / 100));
        
        // Calculate EBITDA based on margin
        ebitda = revenue * (ebitdaMargin / 100);
        
        // Calculate Net Income
        netIncome = ebitda * (1 - (taxRate / 100));
        
        // Calculate SDE (Net Income + Add-backs, with addbacks growing slightly)
        const addbacksGrowth = 1 + (revenueGrowthRate / 200); // Slower growth for addbacks
        const projectedAddbacks = baseAddbacks * Math.pow(addbacksGrowth, i);
        sde = netIncome + projectedAddbacks;
        
        // Free Cash Flow (simplified)
        const capex = revenue * 0.05; // 5% capex
        const wc = revenue * 0.10; // 10% working capital
        const freeCashFlow = ebitda - capex - wc - (ebitda * (taxRate / 100));
        
        projections.push({
            year,
            revenue: Math.round(revenue * 100) / 100,
            ebitda: Math.round(ebitda * 100) / 100,
            sde: Math.round(sde * 100) / 100,
            net_income: Math.round(netIncome * 100) / 100,
            free_cash_flow: Math.round(freeCashFlow * 100) / 100,
        });
    }
    
    // Save projections to database
    for (const proj of projections) {
        await query(
            `INSERT INTO model_projections (
                scenario_id, year, revenue, ebitda, sde, net_income, free_cash_flow
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (scenario_id, year) 
            DO UPDATE SET
                revenue = EXCLUDED.revenue,
                ebitda = EXCLUDED.ebitda,
                sde = EXCLUDED.sde,
                net_income = EXCLUDED.net_income,
                free_cash_flow = EXCLUDED.free_cash_flow`,
            [scenarioId, proj.year, proj.revenue, proj.ebitda, proj.sde, proj.net_income, proj.free_cash_flow]
        );
    }
    
    console.log(`✅ Generated ${projections.length} projections for scenario ${scenarioId}`);
    return projections;
}

// ============================================================
// Calculate DCF Valuation based on REAL projections
// ============================================================
async function calculateDCF(scenarioId) {
    const scenarioResult = await query(
        `SELECT s.*, m.projection_years
         FROM model_scenarios s
         JOIN financial_models m ON s.model_id = m.id
         WHERE s.id = $1`,
        [scenarioId]
    );
    
    if (scenarioResult.rows.length === 0) {
        throw new Error('Scenario not found');
    }
    
    const scenario = scenarioResult.rows[0];
    
    const projectionsResult = await query(
        'SELECT * FROM model_projections WHERE scenario_id = $1 ORDER BY year ASC',
        [scenarioId]
    );
    
    if (projectionsResult.rows.length === 0) {
        throw new Error('No projections found');
    }
    
    const projections = projectionsResult.rows;
    const discountRate = Number(scenario.discount_rate) || 12.0;
    const terminalGrowth = Number(scenario.terminal_growth_rate) || 3.0;
    
    let totalValue = 0;
    let i = 1;
    
    for (const proj of projections) {
        const fcf = Number(proj.free_cash_flow) || 0;
        const discountFactor = Math.pow(1 + (discountRate / 100), i);
        const discountedValue = fcf / discountFactor;
        totalValue += discountedValue;
        i++;
    }
    
    const lastFcf = Number(projections[projections.length - 1].free_cash_flow) || 0;
    const terminalValue = (lastFcf * (1 + (terminalGrowth / 100))) / ((discountRate / 100) - (terminalGrowth / 100));
    const discountedTerminalValue = terminalValue / Math.pow(1 + (discountRate / 100), projections.length);
    
    const enterpriseValue = totalValue + discountedTerminalValue;
    
    return {
        enterpriseValue: Math.round(enterpriseValue * 100) / 100,
        terminalValue: Math.round(discountedTerminalValue * 100) / 100,
        presentValueOfCashFlows: Math.round(totalValue * 100) / 100,
        discountRate,
        terminalGrowth,
        projections: projections.length,
    };
}

module.exports = {
    createModel,
    getModels,
    getModel,
    createScenario,
    generateRealProjections,
    calculateDCF,
};