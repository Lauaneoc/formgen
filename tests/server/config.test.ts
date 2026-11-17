import { describe, expect, it } from 'vitest';
import { readApiConfig } from '../../server/config.js';

describe('Configuração da API', () => {
  it('usa HOST e PORT fornecidos pela plataforma de hospedagem', () => {
    const config = readApiConfig({
      HOST: '0.0.0.0',
      PORT: '8000',
    });

    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(8000);
  });

  it('prioriza as variáveis específicas do FormGen', () => {
    const config = readApiConfig({
      HOST: '0.0.0.0',
      PORT: '8000',
      FORMGEN_API_HOST: '127.0.0.1',
      FORMGEN_API_PORT: '8787',
    });

    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(8787);
  });
});
