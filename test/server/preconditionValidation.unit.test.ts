/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import semver from 'semver'
import { engines as supportedEngines } from './../../package.json'
import { checkIfRunningOnSupportedNodeVersion, checkIfPortIsAvailable, checkIfEnvironmentVariableExists } from '../../lib/startup/validatePreconditions'

void describe('preconditionValidation', () => {
  void describe('checkIfRunningOnSupportedNodeVersion', () => {
    void it('should define the supported semver range as 22 - 26', () => {
      assert.equal(supportedEngines.node, '22 - 26')
      assert.notEqual(semver.validRange(supportedEngines.node), null)
    })

    void it('should accept a supported version', () => {
      assert.equal(checkIfRunningOnSupportedNodeVersion('26.42.1'), true)
      assert.equal(checkIfRunningOnSupportedNodeVersion('25.8.1'), true)
      assert.equal(checkIfRunningOnSupportedNodeVersion('24.2.0'), true)
      assert.equal(checkIfRunningOnSupportedNodeVersion('23.11.1'), true)
      assert.equal(checkIfRunningOnSupportedNodeVersion('22.16.0'), true)
    })

    void it('should fail for an unsupported version', () => {
      assert.equal(checkIfRunningOnSupportedNodeVersion('21.7.3'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('20.19.2'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('19.9.0'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('18.20.4'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('17.3.0'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('16.10.0'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('15.9.0'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('14.0.0'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('13.13.0'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('12.16.2'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('11.14.0'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('10.20.0'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('9.11.2'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('8.12.0'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('7.10.1'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('6.14.4'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('4.9.1'), false)
      assert.equal(checkIfRunningOnSupportedNodeVersion('0.12.8'), false)
    })
  })

  void describe('checkIfPortIsAvailable', () => {
    void it('should resolve when port 3000 is closed', async () => {
      const success = await checkIfPortIsAvailable(3000)
      assert.equal(success, true)
    })

    void describe('open a server before running the test', () => {
      const testServer = net.createServer()
      before(async () => {
        await new Promise<void>((resolve) => { testServer.listen(3000, resolve) })
      })

      void it('should reject when port 3000 is open', async () => {
        const success = await checkIfPortIsAvailable(3000)
        assert.equal(success, false)
      })

      after(async () => {
        await new Promise<void>((resolve) => { testServer.close(() => { resolve() }) })
      })
    })
  })

  void describe('checkIfEnvironmentVariableExists', () => {
    const originalEnv = process.env.ALCHEMY_API_KEY
    after(() => {
      process.env.ALCHEMY_API_KEY = originalEnv
    })

    void it('should return true if environment variable is present', () => {
      process.env.ALCHEMY_API_KEY = 'test-key'
      assert.equal(checkIfEnvironmentVariableExists('ALCHEMY_API_KEY'), true)
    })

    void it('should return false if environment variable is not present', () => {
      delete process.env.ALCHEMY_API_KEY
      assert.equal(checkIfEnvironmentVariableExists('ALCHEMY_API_KEY'), false)
    })

    void it('should return false if a non-existing environment variable is checked', () => {
      assert.equal(checkIfEnvironmentVariableExists('NON_EXISTING_VAR'), false)
    })
  })
})
