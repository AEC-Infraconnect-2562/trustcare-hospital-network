declare module "dicom-parser" {
  export interface DataSet {
    byteArray: Uint8Array;
    elements: Record<string, Element>;
    string(tag: string, index?: number): string | undefined;
    text(tag: string, index?: number): string | undefined;
    uint16(tag: string, index?: number): number | undefined;
    int16(tag: string, index?: number): number | undefined;
    uint32(tag: string, index?: number): number | undefined;
    int32(tag: string, index?: number): number | undefined;
    float(tag: string, index?: number): number | undefined;
    double(tag: string, index?: number): number | undefined;
    intString(tag: string, index?: number): number | undefined;
    floatString(tag: string, index?: number): number | undefined;
    numStringValues(tag: string): number | undefined;
    attributeTag(tag: string): string | undefined;
  }

  export interface Element {
    tag: string;
    vr?: string;
    length: number;
    dataOffset: number;
    items?: Element[];
    dataSet?: DataSet;
    fragments?: { offset: number; position: number; length: number }[];
    encapsulatedPixelData?: boolean;
    hadUndefinedLength?: boolean;
    basicOffsetTable?: number[];
  }

  export function parseDicom(
    byteArray: Uint8Array,
    options?: { untilTag?: string; vrCallback?: (tag: string) => string }
  ): DataSet;

  export function readFixedString(
    byteArray: Uint8Array,
    position: number,
    length: number
  ): string;

  export const littleEndianByteArrayParser: any;
  export const bigEndianByteArrayParser: any;
}
