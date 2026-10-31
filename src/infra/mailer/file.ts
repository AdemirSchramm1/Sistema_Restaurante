import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MailMessage, Mailer } from "@/application/ports";

/** Grava cada e-mail como JSON numa pasta. Usado pelos testes ponta a ponta para ler o link do convite. */
export class FileMailer implements Mailer {
  private seq = 0;
  constructor(private readonly dir: string) {}
  async send(message: MailMessage) {
    await mkdir(this.dir, { recursive: true });
    this.seq += 1;
    const name = `${Date.now()}-${String(this.seq).padStart(4, "0")}.json`;
    await writeFile(path.join(this.dir, name), JSON.stringify(message));
  }
}
