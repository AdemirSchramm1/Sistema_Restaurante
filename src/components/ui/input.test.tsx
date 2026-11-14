// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Input, Select, Textarea } from "./input";

afterEach(cleanup);

const classes = (label: string) => screen.getByLabelText(label).className.split(" ");

/** Spec 013, US6.5: campo que a pessoa toca no celular tem 44 px (`size="lg"`). */
describe("campos: tamanho de toque", () => {
  it("sem size, Input e Select continuam com 40 px", () => {
    render(
      <>
        <Input aria-label="nome" />
        <Select aria-label="seção" />
      </>,
    );
    expect(classes("nome")).toContain("h-10");
    expect(classes("nome")).not.toContain("h-11");
    expect(classes("seção")).toContain("h-10");
  });

  it('size="lg" dá 44 px e letra de 16 px (o iPhone não aproxima a tela ao tocar)', () => {
    render(
      <>
        <Input aria-label="nome" size="lg" />
        <Select aria-label="seção" size="lg" />
        <Textarea aria-label="descrição" size="lg" />
      </>,
    );
    for (const label of ["nome", "seção"]) {
      expect(classes(label)).toContain("h-11");
      expect(classes(label)).not.toContain("h-10");
      expect(classes(label)).toContain("text-base");
    }
    expect(classes("descrição")).toContain("text-base");
    expect(classes("descrição")).toContain("min-h-28");
    // "lg" é tamanho do padrão, não o atributo size do HTML.
    expect(screen.getByLabelText("nome").hasAttribute("size")).toBe(false);
  });

  it("sem size, Textarea continua como era", () => {
    render(<Textarea aria-label="descrição" />);
    expect(classes("descrição")).toContain("min-h-20");
    expect(classes("descrição")).toContain("text-sm");
  });
});
