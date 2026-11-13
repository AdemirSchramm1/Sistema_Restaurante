// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DescriptionField } from "./description-field";

afterEach(cleanup);

/** Descrição do produto (spec 013, US1.6). */
const field = () => screen.getByLabelText("Descrição") as HTMLTextAreaElement;
const hints = () =>
  field()
    .getAttribute("aria-describedby")!
    .split(" ")
    .map((id) => document.getElementById(id)!.textContent);
const type = (value: string) => fireEvent.change(field(), { target: { value } });

describe("campo da descrição", () => {
  it("campo grande, com nome description e o contador ligado a ele", () => {
    render(<DescriptionField defaultValue={null} />);
    expect(field().name).toBe("description");
    expect(field().value).toBe("");
    expect(field().className).toContain("text-base");
    expect(hints()).toEqual(["Faltam 300 caracteres"]);
    expect(field().hasAttribute("aria-invalid")).toBe(false);
    expect(field().hasAttribute("maxlength")).toBe(false);
  });

  it("conta o que já está escrito e o que a pessoa digita", () => {
    render(<DescriptionField defaultValue="Pão, carne e queijo" />);
    expect(hints()).toEqual(["Faltam 281 caracteres"]);
    type("a".repeat(298));
    expect(hints()).toEqual(["Faltam 2 caracteres"]);
    type("a".repeat(299));
    expect(hints()).toEqual(["Falta 1 caractere"]);
    type("a".repeat(300));
    expect(hints()).toEqual(["Faltam 0 caracteres"]);
    expect(field().hasAttribute("aria-invalid")).toBe(false);
  });

  it("avisa ao passar de 300", () => {
    render(<DescriptionField defaultValue={null} />);
    type("a".repeat(301));
    expect(hints()).toEqual(["Passou 1 caractere do limite de 300"]);
    expect(field().getAttribute("aria-invalid")).toBe("true");
    type("a".repeat(305));
    expect(hints()).toEqual(["Passou 5 caracteres do limite de 300"]);
    type("a".repeat(300));
    expect(field().hasAttribute("aria-invalid")).toBe(false);
  });

  it("mantém as quebras de linha e conta cada uma como um caractere, como o servidor", () => {
    render(<DescriptionField defaultValue={"Pão brioche\nCarne de 150 g"} />);
    expect(field().value).toBe("Pão brioche\nCarne de 150 g");
    expect(hints()).toEqual(["Faltam 274 caracteres"]);
    type("um\r\ndois 🍔");
    expect(hints()).toEqual(["Faltam 291 caracteres"]);
  });

  it("mostra o erro do servidor ligado ao campo", () => {
    render(<DescriptionField defaultValue="oi" error="A descrição pode ter até 300 caracteres." />);
    expect(screen.getByRole("alert").textContent).toBe("A descrição pode ter até 300 caracteres.");
    expect(hints()).toEqual(["Faltam 298 caracteres", "A descrição pode ter até 300 caracteres."]);
    expect(field().getAttribute("aria-invalid")).toBe("true");
  });
});
