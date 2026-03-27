import { z } from 'zod';

export const diagramTypeEnum = z.enum([
  'FLOWCHART',
  'ORGCHART',
  'MINDMAP',
  'UML',
  'NETWORK',
  'ER_DIAGRAM',
  'BPMN',
  'WIREFRAME',
  'BLANK',
]);

export const createDiagramSchema = z.object({
  title: z.string().min(1).max(500).default('Untitled Diagram'),
  type: diagramTypeEnum.default('BLANK'),
  templateId: z.string().optional(),
});

export const updateDiagramSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  canvasData: z.object({
    shapes: z.array(z.any()).optional(),
    connectors: z.array(z.any()).optional(),
    layers: z.array(z.any()).optional(),
    viewport: z.object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    }).optional(),
  }).passthrough().optional(),
  isPublic: z.boolean().optional(),
});

export const updateCanvasDataSchema = z.object({
  shapes: z.array(z.any()).optional(),
  connectors: z.array(z.any()).optional(),
  layers: z.array(z.any()).optional(),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }).optional(),
}).passthrough();

export const exportDiagramSchema = z.object({
  format: z.enum(['svg', 'png', 'pdf', 'json']).default('json'),
  width: z.number().int().min(100).max(10000).optional(),
  height: z.number().int().min(100).max(10000).optional(),
  background: z.string().optional(),
});

export type CreateDiagramInput = z.infer<typeof createDiagramSchema>;
export type UpdateDiagramInput = z.infer<typeof updateDiagramSchema>;
export type UpdateCanvasDataInput = z.infer<typeof updateCanvasDataSchema>;
export type ExportDiagramInput = z.infer<typeof exportDiagramSchema>;
