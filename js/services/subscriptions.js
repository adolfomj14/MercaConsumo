// Servicio de Planes, Límites de Escaneo y Monetización
import { getSupabase } from './supabase.js';
import { state } from '../state.js';
import { isUserAdmin } from '../config.js';

export const PLAN_LIMITS = {
  trial: Infinity,   // Facturas ilimitadas durante los 3 días de prueba
  free: 1,           // 1 factura semanal
  premium: 5,        // 5 facturas semanales (~20 al mes)
  pro: Infinity      // Facturas ilimitadas + Multiusuario Familiar
};

export const PLAN_PRICES = {
  free: {
    name: 'Plan Gratuito',
    price: '$0',
    period: 'Siempre gratis',
    limitText: '1 factura semanal',
    hasFamily: false
  },
  premium: {
    name: 'Plan Premium',
    price: '$9.900 COP',
    period: '/ mes',
    limitText: '5 facturas semanales (~20 al mes)',
    hasFamily: false
  },
  pro: {
    name: 'Plan Pro',
    price: '$19.900 COP',
    period: '/ mes',
    limitText: 'Facturas ilimitadas + Perfiles Familiares (Netflix)',
    hasFamily: true
  }
};

export async function getUserSubscriptionInfo() {
  const user = state.user;
  if (!user) return null;

  // 1. Si es el Administrador oficial registrado en Supabase
  if (isUserAdmin(user)) {
    return {
      plan: 'pro',
      planName: '👑 Administrador / Pro',
      isTrial: false,
      trialDaysLeft: 0,
      scansUsed: 0,
      scansLimit: Infinity,
      scansRemaining: Infinity,
      canScan: true,
      canManageFamily: true,
      isAdmin: true
    };
  }

  const sb = getSupabase();
  let profile = null;

  if (sb) {
    try {
      const { data } = await sb.from('profiles').select('*').eq('id', user.id).single();
      profile = data;
    } catch (e) {
      console.warn('[Subscription] Error cargando perfil:', e);
    }
  }

  const now = new Date();
  const createdAt = user.created_at ? new Date(user.created_at) : now;
  
  // 3 Días de Prueba inicial
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : new Date(createdAt.getTime() + (3 * 24 * 60 * 60 * 1000));
  const isTrialActive = now < trialEndsAt;
  const trialDaysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  let rawPlan = (profile?.plan || '').toLowerCase().trim();
  let plan = 'free';

  if (rawPlan === 'free' || rawPlan === 'premium' || rawPlan === 'pro') {
    // Respeta el plan asignado en base de datos explícitamente
    plan = rawPlan;
  } else if (rawPlan === 'trial') {
    plan = isTrialActive ? 'trial' : 'free';
  } else if (!rawPlan) {
    // Usuario nuevo sin plan asignado
    plan = isTrialActive ? 'trial' : 'free';
  }

  // Reinicio semanal (lunes)
  let scansThisWeek = Number(profile?.scans_this_week) || 0;
  const lastWeekDate = profile?.week_start_date ? new Date(profile.week_start_date) : null;

  const currentMonday = getMonday(now);
  if (lastWeekDate && lastWeekDate.toISOString().split('T')[0] !== currentMonday.toISOString().split('T')[0]) {
    scansThisWeek = 0;
    if (sb) {
      sb.from('profiles').update({
        scans_this_week: 0,
        week_start_date: currentMonday.toISOString().split('T')[0]
      }).eq('id', user.id).then();
    }
  }

  const scansLimit = PLAN_LIMITS[plan] !== undefined ? PLAN_LIMITS[plan] : 1;
  const scansRemaining = scansLimit === Infinity ? Infinity : Math.max(0, scansLimit - scansThisWeek);
  const canScan = scansLimit === Infinity || scansRemaining > 0;
  const canManageFamily = plan === 'pro' || plan === 'trial' || isUserAdmin(user);

  let planDisplayName = 'Plan Gratuito (1 factura/sem)';
  if (plan === 'trial') planDisplayName = `✨ Prueba Gratis (${trialDaysLeft} ${trialDaysLeft === 1 ? 'día' : 'días'})`;
  if (plan === 'premium') planDisplayName = '⭐️ Plan Premium (5 facturas/sem)';
  if (plan === 'pro') planDisplayName = '🚀 Plan Pro (Ilimitado)';

  return {
    plan,
    planName: planDisplayName,
    isTrial: isTrialActive,
    trialDaysLeft,
    scansUsed: scansThisWeek,
    scansLimit,
    scansRemaining,
    canScan,
    canManageFamily,
    isAdmin: false
  };
}

export async function recordScanUsage() {
  const user = state.user;
  if (!user || isUserAdmin(user)) return;

  const sb = getSupabase();
  if (!sb) return;

  try {
    const { data: prof } = await sb.from('profiles').select('scans_this_week, week_start_date').eq('id', user.id).single();
    const currentMonday = getMonday(new Date()).toISOString().split('T')[0];
    const newCount = (Number(prof?.scans_this_week) || 0) + 1;

    await sb.from('profiles').update({
      scans_this_week: newCount,
      week_start_date: currentMonday
    }).eq('id', user.id);
  } catch (e) {
    console.warn('[Subscription] Error actualizando escaneo:', e);
  }
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
