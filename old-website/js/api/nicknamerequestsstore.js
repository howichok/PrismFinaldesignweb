/* ═══════════════════════════════════════════════════════════════════════════
   PrismMTR — Nickname Requests Store
   CRUD operations for nickname change requests
   ═══════════════════════════════════════════════════════════════════════════ */

const NicknameRequestsStore = (function () {
  'use strict';

  const BIN_ID = JSONBin.CONFIG.BINS.NICKNAME_REQUESTS;

  // ═══════════════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async function getAll() {
    const data = await JSONBin.read(BIN_ID);
    return data.requests || [];
  }

  async function getById(requestId) {
    const requests = await getAll();
    return requests.find(r => r.id === requestId) || null;
  }

  async function getByUser(userId) {
    const requests = await getAll();
    return requests.filter(r => r.userId === userId);
  }

  async function getPending() {
    const requests = await getAll();
    return requests.filter(r => r.status === 'pending');
  }

  async function hasPendingRequest(userId) {
    const requests = await getAll();
    return requests.some(r => r.userId === userId && r.status === 'pending');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async function create(userId, currentMcNickname, requestedNickname) {
    // Check for existing pending request
    const hasPending = await hasPendingRequest(userId);
    if (hasPending) {
      throw new Error('You already have a pending nickname request');
    }

    const requests = await getAll();
    
    const newRequest = {
      id: JSONBin.generateId('req'),
      userId,
      currentMcNickname,
      requestedNickname,
      status: 'pending',
      createdAt: JSONBin.getTimestamp(),
      resolvedAt: null,
      resolvedBy: null,
    };

    requests.push(newRequest);
    await JSONBin.write(BIN_ID, { requests });
    
    return newRequest;
  }

  async function approve(requestId, resolverUser) {
    // Only mod/admin can approve
    if (!['mod', 'admin'].includes(resolverUser.role)) {
      throw new Error('Insufficient permissions to approve requests');
    }

    const requests = await getAll();
    const index = requests.findIndex(r => r.id === requestId);
    
    if (index === -1) {
      throw new Error(`Request not found: ${requestId}`);
    }

    const request = requests[index];
    
    if (request.status !== 'pending') {
      throw new Error('This request has already been resolved');
    }

    // Update request
    requests[index] = {
      ...request,
      status: 'approved',
      resolvedAt: JSONBin.getTimestamp(),
      resolvedBy: resolverUser.id,
    };

    await JSONBin.write(BIN_ID, { requests });

    // Update user's nickname
    await UsersStore.update(request.userId, {
      nickname: request.requestedNickname,
    });

    return requests[index];
  }

  async function deny(requestId, resolverUser, reason = null) {
    // Only mod/admin can deny
    if (!['mod', 'admin'].includes(resolverUser.role)) {
      throw new Error('Insufficient permissions to deny requests');
    }

    const requests = await getAll();
    const index = requests.findIndex(r => r.id === requestId);
    
    if (index === -1) {
      throw new Error(`Request not found: ${requestId}`);
    }

    const request = requests[index];
    
    if (request.status !== 'pending') {
      throw new Error('This request has already been resolved');
    }

    requests[index] = {
      ...request,
      status: 'denied',
      denyReason: reason,
      resolvedAt: JSONBin.getTimestamp(),
      resolvedBy: resolverUser.id,
    };

    await JSONBin.write(BIN_ID, { requests });
    return requests[index];
  }

  async function cancel(requestId, userId) {
    const requests = await getAll();
    const index = requests.findIndex(r => r.id === requestId);
    
    if (index === -1) {
      throw new Error(`Request not found: ${requestId}`);
    }

    const request = requests[index];
    
    // Only the requester can cancel their own request
    if (request.userId !== userId) {
      throw new Error('You can only cancel your own requests');
    }

    if (request.status !== 'pending') {
      throw new Error('Only pending requests can be cancelled');
    }

    requests[index] = {
      ...request,
      status: 'cancelled',
      resolvedAt: JSONBin.getTimestamp(),
      resolvedBy: userId,
    };

    await JSONBin.write(BIN_ID, { requests });
    return requests[index];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    getAll,
    getById,
    getByUser,
    getPending,
    hasPendingRequest,
    create,
    approve,
    deny,
    cancel,
  };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NicknameRequestsStore;
}
