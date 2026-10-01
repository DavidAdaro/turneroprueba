import { jwt } from 'hono/jwt';

export const requireAuth = async (c, next) => {
  const middleware = jwt({ secret: c.env.JWT_SECRET, alg: 'HS256' });
  return middleware(c, next);
};

// Exige que el usuario autenticado tenga uno de los roles indicados.
export function requireRole(...roles) {
  return async (c, next) => {
    const payload = c.get('jwtPayload');
    if (!payload || !roles.includes(payload.role)) {
      return c.json({ error: 'No tenés permisos para esta acción' }, 403);
    }
    return next();
  };
}

export const userOf = (c) => c.get('jwtPayload');
