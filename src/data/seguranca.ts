// Senha do app. Não há servidor: a senha nunca é guardada, só um verificador
// derivado dela (PBKDF2-SHA256, 600 mil iterações) e o token do GitHub
// cifrado com AES-GCM usando uma chave que também sai da senha.

import { base64ParaBytes, bytesParaBase64 } from './github';

export interface Acesso {
  v: 1;
  salt: string;
  iteracoes: number;
  verificador: string;
}

export interface Cifra {
  iv: string;
  dado: string;
}

const ITERACOES = 600_000;
export const SENHA_MINIMA = 8;

function buf(b: Uint8Array): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

async function derivar(senha: string, salt: Uint8Array, iteracoes: number): Promise<{ verificador: string; chave: CryptoKey }> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: buf(salt), iterations: iteracoes }, base, 512));
  // Metade vira o verificador (com mais um hash), a outra metade a chave AES.
  const verificador = bytesParaBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', bits.slice(0, 32))));
  const chave = await crypto.subtle.importKey('raw', bits.slice(32), 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { verificador, chave };
}

export async function criarAcesso(senha: string): Promise<{ acesso: Acesso; chave: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { verificador, chave } = await derivar(senha, salt, ITERACOES);
  return { acesso: { v: 1, salt: bytesParaBase64(salt), iteracoes: ITERACOES, verificador }, chave };
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Devolve a chave se a senha confere; null se não.
export async function conferir(senha: string, acesso: Acesso): Promise<CryptoKey | null> {
  const { verificador, chave } = await derivar(senha, base64ParaBytes(acesso.salt), acesso.iteracoes);
  return iguais(verificador, acesso.verificador) ? chave : null;
}

export async function cifrar(chave: CryptoKey, texto: string): Promise<Cifra> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv) }, chave, new TextEncoder().encode(texto)));
  return { iv: bytesParaBase64(iv), dado: bytesParaBase64(dado) };
}

export async function decifrar(chave: CryptoKey, c: Cifra): Promise<string> {
  const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(base64ParaBytes(c.iv)) }, chave, buf(base64ParaBytes(c.dado)));
  return new TextDecoder().decode(claro);
}
