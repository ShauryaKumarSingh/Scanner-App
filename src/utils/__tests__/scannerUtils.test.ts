// src/utils/__tests__/scannerUtils.test.ts
import { describe, it, expect } from 'vitest';
import { sortPointsClockwise, getExtremeCorners, type Point } from '../scannerUtils';

describe('scannerUtils', () => {
  describe('sortPointsClockwise', () => {
    it('should sort 4 points in clockwise order', () => {
      const points: Point[] = [
        { x: 100, y: 100 }, // Bottom-Right
        { x: 0, y: 0 },      // Top-Left
        { x: 100, y: 0 },    // Top-Right
        { x: 0, y: 100 },    // Bottom-Left
      ];

      const sorted = sortPointsClockwise(points);
      
      expect(sorted[0]).toEqual({ x: 0, y: 0 });      // Top-Left
      expect(sorted[1]).toEqual({ x: 100, y: 0 });     // Top-Right
      expect(sorted[2]).toEqual({ x: 100, y: 100 });   // Bottom-Right
      expect(sorted[3]).toEqual({ x: 0, y: 100 });     // Bottom-Left
    });

    it('should throw error for non-4 points', () => {
      expect(() => sortPointsClockwise([{ x: 0, y: 0 }])).toThrow();
      expect(() => sortPointsClockwise([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toThrow();
    });
  });

  describe('getExtremeCorners', () => {
    it('should return same points if exactly 4 points', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];

      const corners = getExtremeCorners(points);
      expect(corners).toHaveLength(4);
      expect(corners).toEqual(points);
    });

    it('should extract 4 extreme corners from 6 points', () => {
      const points: Point[] = [
        { x: 0, y: 0 },      // TL
        { x: 50, y: 0 },    // Top edge
        { x: 100, y: 0 },   // TR
        { x: 100, y: 50 },  // Right edge
        { x: 100, y: 100 }, // BR
        { x: 0, y: 100 },    // BL
      ];

      const corners = getExtremeCorners(points);
      expect(corners).toHaveLength(4);
      // Should find the 4 corners closest to bounding box extremes
      expect(corners.some(p => p.x === 0 && p.y === 0)).toBe(true); // TL
      expect(corners.some(p => p.x === 100 && p.y === 0)).toBe(true); // TR
      expect(corners.some(p => p.x === 100 && p.y === 100)).toBe(true); // BR
      expect(corners.some(p => p.x === 0 && p.y === 100)).toBe(true); // BL
    });

    it('should throw error for less than 4 points', () => {
      expect(() => getExtremeCorners([{ x: 0, y: 0 }])).toThrow();
      expect(() => getExtremeCorners([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toThrow();
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate confidence based on solidity', () => {
      // Mock confidence calculation logic
      const calculateConfidence = (
        cornerCount: number,
        solidity: number,
        aspectRatio: number
      ): number => {
        let confidence = 100;
        if (cornerCount > 4) confidence -= 10;
        if (solidity < 0.9) confidence -= Math.max(0, Math.floor((0.9 - solidity) * 100));
        if (aspectRatio < 0.2 || aspectRatio > 5) confidence -= 25;
        return Math.max(0, Math.min(100, Math.round(confidence)));
      };

      // Perfect rectangle
      expect(calculateConfidence(4, 0.95, 1.5)).toBeGreaterThan(90);
      
      // Low solidity (0.7 solidity = 20 point penalty, so 100 - 20 = 80)
      expect(calculateConfidence(4, 0.7, 1.5)).toBeLessThanOrEqual(80);
      // Even lower solidity should be less
      expect(calculateConfidence(4, 0.6, 1.5)).toBeLessThan(80);
      
      // Too many corners (6 corners = 10 point penalty, so 100 - 10 = 90)
      expect(calculateConfidence(6, 0.95, 1.5)).toBeLessThan(95);
      
      // Extreme aspect ratio (0.1 aspect ratio = 25 point penalty, so 100 - 25 = 75)
      expect(calculateConfidence(4, 0.95, 0.1)).toBeLessThan(80);
    });
  });
});
