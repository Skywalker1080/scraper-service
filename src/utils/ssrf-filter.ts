import dns from "dns";
import ipaddr from "ipaddr.js";

/**
 * Validates a URL to ensure it points to a public IP address.
 * Throws an Error if the URL resolves to a private or restricted IP.
 */
export async function validatePublicUrl(targetUrl: string): Promise<void> {
  const parsedUrl = new URL(targetUrl);
  
  // Only allow http and https
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
  }

  const hostname = parsedUrl.hostname;

  try {
    // Resolve the hostname to an IP address
    const { address } = await dns.promises.lookup(hostname);
    
    // Parse the IP address using ipaddr.js
    const ip = ipaddr.parse(address);
    const range = ip.range();

    // The 'unicast' range generally represents public IPs in ipaddr.js
    // We reject common internal ranges: 
    // 'private', 'uniqueLocal', 'loopback', 'unspecified', 'multicast', 'broadcast', 'linkLocal'
    if (range !== "unicast") {
      throw new Error(`SSRF Protected: Resolved IP ${address} (${range}) is not a public IP`);
    }
  } catch (error: any) {
    if (error.code === 'ENOTFOUND') {
       throw new Error(`Cannot resolve hostname: ${hostname}`);
    }
    throw error;
  }
}
