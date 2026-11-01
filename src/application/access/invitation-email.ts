import type { MailMessage } from "../ports";
import { ROLE_LABELS, type Role } from "@/domain/access/permissions";
import { INVITATION_DAYS } from "@/domain/access/invitation";

/** Texto do e-mail de convite (pt-BR). */
export function invitationEmail(input: {
  to: string;
  restaurantName: string;
  roles: Role[];
  link: string;
}): MailMessage {
  const roles = input.roles.map((r) => ROLE_LABELS[r]).join(", ");
  return {
    to: input.to,
    subject: `Convite para a equipe do ${input.restaurantName}`,
    text: [
      `Olá!`,
      ``,
      `Você foi convidado para a equipe do ${input.restaurantName} no sistema de estoque, como ${roles}.`,
      ``,
      `Para aceitar, abra o link abaixo e defina seu nome e senha:`,
      input.link,
      ``,
      `O convite vale por ${INVITATION_DAYS} dias. Se você não esperava este e-mail, pode ignorá-lo.`,
    ].join("\n"),
  };
}
