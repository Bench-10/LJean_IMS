export function getNextApprover(request) {
  if (!request) return null;
  // Inventory requests: rely on status_detail.code
  const code = (request.status_detail && request.status_detail.code) ? String(request.status_detail.code).toLowerCase() : null;
  if (request.kind === 'inventory' || code) {
    if (code === 'pending_manager' || code === 'pending') return 'branch_manager';
    if (code === 'pending_admin') return 'owner';
    return null;
  }

  // User requests: look for timeline.manager or admin stage
  try {
    const timeline = request.timeline || {};
    if (timeline.manager && String(timeline.manager.status).toLowerCase() === 'pending') return 'branch_manager';
    if (timeline.admin && String(timeline.admin.status).toLowerCase() === 'pending') return 'owner';
    // fallback: if the normalized_status is pending, assume owner is responsible
    const ns = (request.normalized_status || request.user_status || '').toLowerCase();
    if (ns === 'pending') return 'owner';
  } catch (e) { /* ignore */ }

  return null;
}

export function computeApprovalLabel(request, { isOwner = false, isBranchManager = false, viewerScope = 'user' } = {}) {
  const next = getNextApprover(request);

  // System-Level (general view): viewer is neither BM nor Owner (or viewerScope is 'user')
  const viewerIsBM = !!isBranchManager;
  const viewerIsOwner = !!isOwner;

  if (!viewerIsBM && !viewerIsOwner) {
    if (next === 'branch_manager') return 'Awaiting Branch Manager Approval';
    if (next === 'owner') return 'Awaiting Owner Approval';
    // Fallbacks
    if (request.status_detail && request.status_detail.label) return request.status_detail.label;
    if (request.user_status === 'pending') return 'Awaiting Owner Approval';
    return request.status_detail?.label || request.status || 'Pending';
  }

  // Branch Manager view
  if (viewerIsBM && !viewerIsOwner) {
    if (next === 'branch_manager') return 'For Approval';
    // When the owner is the next approver, show an informational label
    // rather than a BM-facing 'For Owner Approval'. This keeps the
    // Branch Manager's view consistent after they approve a new product.
    if (next === 'owner') return 'Awaiting Owner Approval';
    // fallback: if pending -> For Approval
    const fallback = (request.status_detail && request.status_detail.label) ? request.status_detail.label : (request.user_status === 'pending' ? 'For Approval' : (request.status_detail?.label || request.status || 'Pending'));
    return fallback;
  }

  // Owner view
  if (viewerIsOwner) {
    if (next === 'owner') return 'For Approval';
    if (next === 'branch_manager') return 'Awaiting Branch Manager Approval';
    // fallback
    if (request.status_detail && request.status_detail.label) return request.status_detail.label;
    return request.user_status === 'pending' ? 'For Approval' : (request.status_detail?.label || request.status || 'Pending');
  }

  // Default
  return request.status_detail?.label || request.user_status || request.status || 'Pending';
}
