/** Create an OAuth App at https://github.com/settings/developers (device flow). */
export const DEFAULT_GITHUB_OAUTH_CLIENT_ID = '';

export function getGitHubClientId(): string {
  return (process.env.GIT3_GITHUB_CLIENT_ID || DEFAULT_GITHUB_OAUTH_CLIENT_ID).trim();
}

export interface DeviceStartResult {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface DevicePollResult {
  status: 'pending' | 'slow_down' | 'authorized' | 'expired' | 'denied' | 'error';
  accessToken?: string;
  error?: string;
}

export async function startDeviceFlow(clientId: string): Promise<DeviceStartResult> {
  const body = new URLSearchParams({
    client_id: clientId,
    scope: 'repo',
  });
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = (await res.json()) as {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    expires_in?: number;
    interval?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.device_code || !data.user_code || !data.verification_uri) {
    throw new Error(data.error_description || data.error || 'Could not start GitHub login');
  }
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in || 900,
    interval: data.interval || 5,
  };
}

export async function pollDeviceFlow(
  clientId: string,
  deviceCode: string
): Promise<DevicePollResult> {
  const body = new URLSearchParams({
    client_id: clientId,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  });
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.access_token) {
    return { status: 'authorized', accessToken: data.access_token };
  }

  switch (data.error) {
    case 'authorization_pending':
      return { status: 'pending' };
    case 'slow_down':
      return { status: 'slow_down' };
    case 'expired_token':
      return { status: 'expired', error: 'Login code expired. Start again.' };
    case 'access_denied':
      return { status: 'denied', error: 'GitHub login was denied.' };
    default:
      return {
        status: 'error',
        error: data.error_description || data.error || 'GitHub login failed',
      };
  }
}

export async function fetchGitHubUser(token: string): Promise<{ login: string }> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'git3-studio',
    },
  });
  if (!res.ok) {
    throw new Error('Could not load GitHub user for this token');
  }
  const data = (await res.json()) as { login: string };
  return { login: data.login };
}

export async function listOwnedRepos(
  token: string
): Promise<Array<{ name: string; fullName: string; private: boolean }>> {
  const res = await fetch(
    'https://api.github.com/user/repos?per_page=100&affiliation=owner&sort=updated',
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'git3-studio',
      },
    }
  );
  if (!res.ok) {
    throw new Error('Could not list repositories');
  }
  const data = (await res.json()) as Array<{
    name: string;
    full_name: string;
    private: boolean;
  }>;
  return data.map((repo) => ({
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
  }));
}
