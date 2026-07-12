function computeMetrics(transactions) {
  const sums = {};
  for (const t of transactions) {
    sums[t.category] = (sums[t.category] || 0) + Number(t.amount);
  }

  const totalRevenue = sums['Revenue'] || 0;

  const expenseCategories = Object.keys(sums).filter((c) => c !== 'Revenue');
  const totalExpenses = expenseCategories.reduce((sum, c) => sum + Math.abs(sums[c]), 0);

  const netIncome = totalRevenue - totalExpenses;

  const interest = Math.abs(sums['Interest Expense'] || 0);
  const taxes = Math.abs(sums['Taxes'] || 0);
  const depreciation = Math.abs(sums['Depreciation & Amortization'] || 0);
  const ownerComp = Math.abs(sums['Owner Compensation'] || 0);

  const ebitda = netIncome + interest + taxes + depreciation;

  const totalAddbacks = transactions
    .filter((t) => t.isAddback)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  const sde = ebitda + ownerComp + totalAddbacks;

  return {
    totalRevenue: round2(totalRevenue),
    totalExpenses: round2(totalExpenses),
    netIncome: round2(netIncome),
    ebitda: round2(ebitda),
    sde: round2(sde),
    totalAddbacks: round2(totalAddbacks),
    categoryBreakdown: Object.fromEntries(
      Object.entries(sums).map(([k, v]) => [k, round2(v)])
    ),
  };
}

function buildAddbackSchedule(transactions) {
  const groups = {};
  for (const t of transactions.filter((t) => t.isAddback)) {
    const key = t.addbackReason || 'Other Add-back';
    if (!groups[key]) {
      groups[key] = { label: key, category: 'Personal / Discretionary', amount: 0, count: 0, justification: t.addbackReason };
    }
    groups[key].amount += Math.abs(Number(t.amount));
    groups[key].count += 1;
  }
  return Object.values(groups).map((g) => ({
    ...g,
    amount: round2(g.amount),
  }));
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = { computeMetrics, buildAddbackSchedule };