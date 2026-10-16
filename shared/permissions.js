/* UI-level role helpers shared by all profile modules. Database RLS remains the security boundary. */
(() => {
  const normalize = value => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  function hasRole(membership, allowed) {
    const role = normalize(membership?.role);
    const roles = (Array.isArray(allowed) ? allowed : [allowed]).map(normalize);
    return !!role && roles.includes(role);
  }
  function canManageCompany(membership) { return hasRole(membership, ['owner', 'admin']); }
  function canManageMembers(membership) { return hasRole(membership, ['owner', 'admin']); }
  function canManageProfile(membership) { return canManageCompany(membership); }
  function canManageFinance(membership) { return hasRole(membership, ['owner', 'admin', 'finance_manager', 'accountant']); }
  function canManageInventory(membership) { return hasRole(membership, ['owner', 'admin', 'inventory_manager', 'storekeeper']); }
  window.MolanPermissions = Object.freeze({ hasRole, canManageCompany, canManageMembers, canManageProfile, canManageFinance, canManageInventory });
})();