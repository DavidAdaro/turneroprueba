import { useEffect, useState } from 'react';
import { api } from '../api';

// Catálogos que casi no cambian: se cachean durante la sesión.
const cache = {};
export function invalidateCatalogs() {
  for (const k of Object.keys(cache)) delete cache[k];
}

const LOADERS = {
  settings: api.getSettings,
  insurances: api.getInsurances,
  equipment: api.getEquipment,
  studies: api.getStudies,
};

export function useCatalog(name) {
  const [data, setData] = useState(cache[name]?.value ?? null);
  useEffect(() => {
    if (!cache[name]) cache[name] = { promise: LOADERS[name]() };
    let alive = true;
    cache[name].promise
      .then((v) => {
        if (cache[name]) cache[name].value = v;
        if (alive) setData(v);
      })
      .catch(() => {
        delete cache[name];
      });
    return () => {
      alive = false;
    };
  }, [name]);
  return data;
}
