import { Resend } from "resend";
import type { MailMessage, Mailer } from "@/application/ports";

export class ResendMailer implements Mailer {
  private readonly client: Resend;
  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }
  async send(message: MailMessage) {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    if (error) throw new Error(`Falha ao enviar e-mail: ${error.message}`);
  }
}
