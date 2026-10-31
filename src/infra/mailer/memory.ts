import type { MailMessage, Mailer } from "@/application/ports";

/** Guarda os e-mails em memória (desenvolvimento e testes) e mostra no log. */
export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  constructor(private readonly log = false) {}
  async send(message: MailMessage) {
    this.sent.push(message);
    if (this.log) console.info(`[e-mail] para ${message.to}: ${message.subject}\n${message.text}`);
  }
  last(to?: string) {
    return [...this.sent].reverse().find((m) => !to || m.to === to);
  }
}
