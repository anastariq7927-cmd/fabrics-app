import { supabasePublic, supabaseAsUser, bearerToken, HttpError } from '@fabrics/shared';

async function resolveUser(req) {
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, 'Unauthorized');

  const { data, error } = await supabasePublic().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Invalid or expired session');

  // RLS only lets a user see their own row in admins, so this query runs as them.
  const { data: admin } = await supabaseAsUser(token)
    .from('admins')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle();

  return { id: data.user.id, email: data.user.email, isAdmin: Boolean(admin) };
}

export function requireUser(req, _res, next) {
  resolveUser(req)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(next);
}

export function requireAdmin(req, res, next) {
  requireUser(req, res, (err) => {
    if (err) return next(err);
    if (!req.user.isAdmin) return next(new HttpError(403, 'Admins only'));
    next();
  });
}
