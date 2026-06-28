import bcrypt from 'bcrypt';
export const hashKey   = (k: string) => bcrypt.hash(k, 10);
export const verifyKey = (k: string, h: string) => bcrypt.compare(k, h);
