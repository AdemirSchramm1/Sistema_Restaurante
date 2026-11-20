import { describe, it, expect } from "vitest";
import { d } from "../shared/decimal";
import { toCsv } from "./csv";

const BOM = "﻿";

describe("planilha de vendas (spec 014, US6-7 e research R8)", () => {
  it("usa ponto e vírgula, BOM e quebra de linha do Windows, para o Excel em português abrir em colunas", () => {
    expect(
      toCsv([
        ["Produto", "Quantidade", "Valor"],
        ["X-Burger", 3, d("94")],
      ]),
    ).toBe(`${BOM}Produto;Quantidade;Valor\r\nX-Burger;3;94,00\r\n`);
  });

  it("dinheiro sai com vírgula e 2 casas; negativo continua número", () => {
    expect(toCsv([[d("1234.5"), d("-2"), d("0")]])).toBe(`${BOM}1234,50;-2,00;0,00\r\n`);
    expect(toCsv([[-2, 0]])).toBe(`${BOM}-2;0\r\n`);
  });

  it("escapa aspas, ponto e vírgula e quebra de linha", () => {
    expect(toCsv([['Suco "da casa"; 500 ml']])).toBe(`${BOM}"Suco ""da casa""; 500 ml"\r\n`);
    expect(toCsv([["duas\nlinhas"], ["volta\rcarro"]])).toBe(`${BOM}"duas\nlinhas"\r\n"volta\rcarro"\r\n`);
  });

  it("texto que começa com =, +, - ou @ ganha apóstrofo (não vira fórmula)", () => {
    expect(toCsv([["=1+1", "+55", "-Suco", "@casa", "Suco - laranja"]])).toBe(
      `${BOM}'=1+1;'+55;'-Suco;'@casa;Suco - laranja\r\n`,
    );
    expect(toCsv([['=A1;"x"']])).toBe(`${BOM}"'=A1;""x"""\r\n`);
  });

  it("célula vazia e lista vazia", () => {
    expect(toCsv([["", "a"]])).toBe(`${BOM};a\r\n`);
    expect(toCsv([])).toBe(BOM);
  });
});
