// Edge Function: Rekognition Face Liveness bridge.
//
// The only component holding AWS credentials (AWS_ACCESS_KEY_ID /
// AWS_SECRET_ACCESS_KEY / AWS_REGION, set as function secrets). The app calls
// it with the user's Supabase JWT:
//   { action: "create" }                → { sessionId }
//   { action: "result", sessionId }     → { verified, confidence, referenceImage }
// On "result" it stores the liveness reference frame in the private
// verifications bucket and records the outcome via apply_liveness_result()
// (service role — the sole write-path to verified status). referenceImage is
// returned base64-encoded so the app can offer it as the profile photo: the
// photo people see is provably the face that passed the check.

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
  RekognitionClient,
} from 'npm:@aws-sdk/client-rekognition@3';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const rekognition = new RekognitionClient({
  region: Deno.env.get('AWS_REGION') ?? 'us-east-1',
  credentials: {
    accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') ?? '',
    secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? '',
  },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // The caller must be a signed-in user; their identity comes from the JWT,
  // never from the request body.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: 'Not signed in' }, 401);

  let body: { action?: string; sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  try {
    if (body.action === 'create') {
      const out = await rekognition.send(new CreateFaceLivenessSessionCommand({}));
      return json({ sessionId: out.SessionId });
    }

    if (body.action === 'result') {
      if (!body.sessionId) return json({ error: 'sessionId required' }, 400);
      const res = await rekognition.send(
        new GetFaceLivenessSessionResultsCommand({ SessionId: body.sessionId }),
      );
      const confidence = res.Confidence ?? 0;

      const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

      // Persist the reference frame (private bucket, service-role only reads).
      let imagePath: string | null = null;
      let referenceImage: string | null = null;
      const bytes = res.ReferenceImage?.Bytes;
      if (bytes && bytes.length > 0) {
        imagePath = `${user.id}/liveness-${Date.now()}.jpg`;
        const { error: uploadError } = await admin.storage
          .from('verifications')
          .upload(imagePath, bytes, { contentType: 'image/jpeg' });
        if (uploadError) imagePath = null;
        else referenceImage = encodeBase64(bytes);
      }

      // The RPC owns the pass threshold and is the only write-path to
      // verified status. SUCCEEDED guards against reading a session that
      // never finished its checks.
      const finished = res.Status === 'SUCCEEDED';
      const { data: passed, error: rpcError } = await admin.rpc('apply_liveness_result', {
        p_user: user.id,
        p_confidence: finished ? confidence : 0,
        p_image_path: imagePath,
      });
      if (rpcError) return json({ error: rpcError.message }, 500);

      return json({
        verified: passed === true,
        confidence,
        referenceImage: passed === true ? referenceImage : null,
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: message }, 502);
  }
});
