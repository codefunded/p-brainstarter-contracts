import dotenv from 'dotenv';
dotenv.config();
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    POLYGON_MAINNET_RPC: z.string().min(1).default('https://polygon-rpc.com'),
    PRIVATE_KEY: z
      .string()
      .min(64),
    POLYGONSCAN_API_KEY: z.string().min(1)
  },
  clientPrefix: 'PUBLIC_',
  client: {},
  runtimeEnv: process.env,
});
