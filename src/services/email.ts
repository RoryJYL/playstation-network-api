import { Resend } from "resend";

export async function sendNpssoExpiryAlert(
  apiKey: string,
  recipientEmail: string,
): Promise<void> {
  const resend = new Resend(apiKey);

  const now = new Date();
  const shanghaiTime = now.toLocaleString("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // Format: YYYY-MM-DD HH:MM:SS
  const [date, time] = shanghaiTime.split(", ");
  const [month, day, year] = date.split("/");
  const formattedTime = `${year}-${month}-${day} ${time}`;

  await resend.emails.send({
    from: "PlayStation Network Monitor <playstation-network-alter@rorytech.com>",
    to: recipientEmail,
    subject: "PlayStation Network NPSSO Token Expiration Alert",
    html: `
      <p>Your PlayStation Network NPSSO token has expired and the refresh token failed to renew it.</p>

      <h3>Action Required:</h3>
      <ol>
        <li>Log in to your PlayStation Network account from the <a href="https://www.playstation.com">official website</a></li>
        <li>Visit <a href="https://ca.account.sony.com/api/v1/ssocookie">ca.account.sony.com/api/v1/ssocookie</a></li>
        <li>Copy the <code>npsso</code> value from the response</li>
        <li>Update your <code>NPSSO_TOKEN</code> environment variable</li>
      </ol>

      <p style="color: #666; font-size: 0.9em;">Time: ${formattedTime}</p>
    `,
  });
}
