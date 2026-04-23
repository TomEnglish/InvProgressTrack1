export function validatePayload(payload: any) {
  if (!payload || !payload.projectId) {
    throw new Error("Missing projectId");
  }
  if (!payload.items || !Array.isArray(payload.items)) {
    throw new Error("Payload items must be an array");
  }
  if (payload.items.length === 0) {
    throw new Error("Payload items array is empty");
  }
  
  const validItems = payload.items.map((item: any, index: number) => {
    const itemReference = item.dwg || item.name || `Row ${index}`;
    
    // Convert string inputs to proper numbers if uploaded via raw CSV logic
    const budget = Number(item.budget_hrs || 0);
    const actual = Number(item.actual_hrs || 0);
    const completed = Number(item.percent_complete || 0);

    if (isNaN(budget) || budget < 0) {
      throw new Error(`Invalid or negative budget hours for item: ${itemReference}`);
    }
    if (isNaN(actual) || actual < 0) {
      throw new Error(`Invalid or negative actual hours for item: ${itemReference}`);
    }
    if (isNaN(completed) || completed < 0 || completed > 100) {
      throw new Error(`Invalid percent complete for item: ${itemReference}. Must be 0-100.`);
    }

    return {
      ...item,
      budget_hrs: budget,
      actual_hrs: actual,
      percent_complete: completed
    };
  });

  return { projectId: payload.projectId, items: validItems };
}
