/**
 * Image Storage Integration Tests
 * 
 * Tests for the complete image upload pipeline from frontend to R2 storage.
 * Validates graceful degradation and error handling.
 * 
 * Test Suite: Story #34C - Backend Image Storage Integration
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_IMAGE_PATH = path.join(__dirname, '../../fixtures/test-invitation.png');

// Store created guest IDs for cleanup
const createdGuestIds = [];

describe('Image Storage Integration Tests', () => {
  beforeAll(() => {
    console.log('🧪 Starting Image Storage Integration Tests...');
    console.log(`📡 API Base URL: ${API_BASE_URL}`);
  });

  afterAll(async () => {
    // Cleanup: Delete all created guests
    console.log('🧹 Cleaning up test guests...');
    for (const guestId of createdGuestIds) {
      try {
        await fetch(`${API_BASE_URL}/api/guests/${guestId}`, {
          method: 'DELETE'
        });
        console.log(`✅ Deleted test guest: ${guestId}`);
      } catch (error) {
        console.error(`❌ Failed to delete guest ${guestId}:`, error.message);
      }
    }
  });

  describe('POST /api/guests - Guest creation with images', () => {
    it('should create guest with FormData (multipart/form-data)', async () => {
      const formData = new FormData();
      formData.append('name', 'Test Guest with Images');
      formData.append('venue', 'hue');
      formData.append('secondaryNote', 'Test note');

      // Create test image buffer
      const imageBuffer = Buffer.from('fake-image-data');
      formData.append('invitationImageFront', imageBuffer, {
        filename: 'test-front.png',
        contentType: 'image/png'
      });
      formData.append('invitationImageMain', imageBuffer, {
        filename: 'test-main.png',
        contentType: 'image/png'
      });

      const response = await fetch(`${API_BASE_URL}/api/guests`, {
        method: 'POST',
        body: formData
      });

      expect(response.status).toBe(201);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.name).toBe('Test Guest with Images');
      expect(result.data.venue).toBe('hue');
      expect(result.data.invitationUrl).toContain('/hue/');

      // Store for cleanup
      createdGuestIds.push(result.data.id);
    });

    it('should create guest without images (graceful degradation)', async () => {
      const formData = new FormData();
      formData.append('name', 'Test Guest No Images');
      formData.append('venue', 'hanoi');

      const response = await fetch(`${API_BASE_URL}/api/guests`, {
        method: 'POST',
        body: formData
      });

      expect(response.status).toBe(201);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.invitationImageFrontUrl).toBeNull();
      expect(result.data.invitationImageMainUrl).toBeNull();

      // Store for cleanup
      createdGuestIds.push(result.data.id);
    });

    it('should validate required fields', async () => {
      const formData = new FormData();
      // Missing name and venue

      const response = await fetch(`${API_BASE_URL}/api/guests`, {
        method: 'POST',
        body: formData
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid file types', async () => {
      const formData = new FormData();
      formData.append('name', 'Test Invalid File');
      formData.append('venue', 'hue');
      
      // Create fake PDF file
      const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf');
      formData.append('invitationImageFront', pdfBuffer, {
        filename: 'test.pdf',
        contentType: 'application/pdf'
      });

      const response = await fetch(`${API_BASE_URL}/api/guests`, {
        method: 'POST',
        body: formData
      });

      // Should still create guest (graceful degradation) but with warnings
      expect(response.status).toBe(201);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);

      // Store for cleanup
      if (result.data?.id) {
        createdGuestIds.push(result.data.id);
      }
    });

    it('should handle files exceeding size limit', async () => {
      const formData = new FormData();
      formData.append('name', 'Test Large File');
      formData.append('venue', 'hue');
      
      // Create fake 10MB file (exceeds 5MB limit)
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024, 'x');
      formData.append('invitationImageFront', largeBuffer, {
        filename: 'large.png',
        contentType: 'image/png'
      });

      const response = await fetch(`${API_BASE_URL}/api/guests`, {
        method: 'POST',
        body: formData
      });

      // Should still create guest with warnings
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();

      // Store for cleanup
      if (result.data?.id) {
        createdGuestIds.push(result.data.id);
      }
    });
  });

  describe('DELETE /api/guests/:id - Image cleanup', () => {
    it('should delete guest and associated images', async () => {
      // First, create a guest with images
      const formData = new FormData();
      formData.append('name', 'Test Delete Guest');
      formData.append('venue', 'hue');
      
      const imageBuffer = Buffer.from('test-image');
      formData.append('invitationImageFront', imageBuffer, {
        filename: 'delete-test.png',
        contentType: 'image/png'
      });

      const createResponse = await fetch(`${API_BASE_URL}/api/guests`, {
        method: 'POST',
        body: formData
      });

      const createResult = await createResponse.json();
      const guestId = createResult.data.id;

      // Now delete the guest
      const deleteResponse = await fetch(`${API_BASE_URL}/api/guests/${guestId}`, {
        method: 'DELETE'
      });

      expect(deleteResponse.status).toBe(200);
      const deleteResult = await deleteResponse.json();
      
      expect(deleteResult.success).toBe(true);

      // Verify guest is deleted
      const getResponse = await fetch(`${API_BASE_URL}/api/guests/${guestId}`);
      expect(getResponse.status).toBe(404);
    });
  });

  describe('Storage Service Configuration', () => {
    it('should handle missing R2 configuration gracefully', async () => {
      // This test assumes R2 is configured, but validates graceful degradation
      const formData = new FormData();
      formData.append('name', 'Test Config Check');
      formData.append('venue', 'hanoi');

      const response = await fetch(`${API_BASE_URL}/api/guests`, {
        method: 'POST',
        body: formData
      });

      // Should always succeed creating guest (with or without R2)
      expect(response.status).toBe(201);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();

      // Store for cleanup
      createdGuestIds.push(result.data.id);
    });
  });

  describe('Image Processing Pipeline', () => {
    it('should process and optimize uploaded images', async () => {
      const formData = new FormData();
      formData.append('name', 'Test Image Processing');
      formData.append('venue', 'hue');
      
      // Create a large unoptimized image buffer
      const largeImage = Buffer.alloc(2 * 1024 * 1024, 'x'); // 2MB
      formData.append('invitationImageFront', largeImage, {
        filename: 'unoptimized.png',
        contentType: 'image/png'
      });

      const response = await fetch(`${API_BASE_URL}/api/guests`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      expect(result.success).toBe(true);
      
      // If images were uploaded successfully, verify URL format
      if (result.data.invitationImageFrontUrl) {
        expect(result.data.invitationImageFrontUrl).toContain('invitations/');
        expect(result.data.invitationImageFrontUrl).toContain('-front.jpg');
      }

      // Store for cleanup
      if (result.data?.id) {
        createdGuestIds.push(result.data.id);
      }
    });

    it('should generate proper date-based folder structure', async () => {
      const formData = new FormData();
      formData.append('name', 'Test Folder Structure');
      formData.append('venue', 'hanoi');
      
      const imageBuffer = Buffer.from('test');
      formData.append('invitationImageMain', imageBuffer, {
        filename: 'test.png',
        contentType: 'image/png'
      });

      const response = await fetch(`${API_BASE_URL}/api/guests`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      // Verify URL contains date-based structure: invitations/{venue}/{year}/{month}/{day}/
      if (result.data.invitationImageMainUrl) {
        const url = result.data.invitationImageMainUrl;
        expect(url).toMatch(/invitations\/hanoi\/\d{4}\/\d{2}\/\d{2}\/.+/);
      }

      // Store for cleanup
      if (result.data?.id) {
        createdGuestIds.push(result.data.id);
      }
    });
  });
});
