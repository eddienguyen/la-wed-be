/**
 * RSVP API Test Script
 * 
 * Manual test script for testing RSVP endpoints
 */

const testRSVP = async () => {
  const baseURL = 'http://localhost:3000'

  console.log('🧪 Testing RSVP API Endpoints\n')

  // Test 1: Create non-personalized RSVP
  console.log('Test 1: Non-personalized RSVP')
  try {
    const response1 = await fetch(`${baseURL}/api/rsvp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Nguyễn Văn Test',
        guestCount: 2,
        willAttend: true,
        wishes: 'Chúc mừng hai bạn hạnh phúc bên nhau mãi mãi',
        venue: 'hue',
        honeypot: ''
      })
    })
    
    const data1 = await response1.json()
    console.log('✅ Status:', response1.status)
    console.log('📦 Response:', JSON.stringify(data1, null, 2))
    console.log('')
  } catch (error) {
    console.error('❌ Error:', error.message)
  }

  // Test 2: Duplicate submission (should update)
  console.log('Test 2: Duplicate non-personalized RSVP (should update)')
  try {
    const response2 = await fetch(`${baseURL}/api/rsvp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Nguyễn Văn Test',
        guestCount: 3,
        willAttend: false,
        wishes: 'Xin lỗi, tôi không thể tham dự',
        venue: 'hue',
        honeypot: ''
      })
    })
    
    const data2 = await response2.json()
    console.log('✅ Status:', response2.status)
    console.log('📦 Response:', JSON.stringify(data2, null, 2))
    console.log('')
  } catch (error) {
    console.error('❌ Error:', error.message)
  }

  // Test 3: Validation error - missing required field
  console.log('Test 3: Validation error - missing willAttend')
  try {
    const response3 = await fetch(`${baseURL}/api/rsvp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test User',
        guestCount: 1,
        venue: 'hanoi',
        honeypot: ''
      })
    })
    
    const data3 = await response3.json()
    console.log('✅ Status:', response3.status)
    console.log('📦 Response:', JSON.stringify(data3, null, 2))
    console.log('')
  } catch (error) {
    console.error('❌ Error:', error.message)
  }

  // Test 4: Invalid guest count
  console.log('Test 4: Validation error - invalid guest count')
  try {
    const response4 = await fetch(`${baseURL}/api/rsvp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test User',
        guestCount: 15,
        willAttend: true,
        venue: 'hue',
        honeypot: ''
      })
    })
    
    const data4 = await response4.json()
    console.log('✅ Status:', response4.status)
    console.log('📦 Response:', JSON.stringify(data4, null, 2))
    console.log('')
  } catch (error) {
    console.error('❌ Error:', error.message)
  }

  // Test 5: Honeypot detection
  console.log('Test 5: Honeypot detection (bot)')
  try {
    const response5 = await fetch(`${baseURL}/api/rsvp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Bot User',
        guestCount: 1,
        willAttend: true,
        venue: 'hue',
        honeypot: 'spam content'
      })
    })
    
    const data5 = await response5.json()
    console.log('✅ Status:', response5.status)
    console.log('📦 Response:', JSON.stringify(data5, null, 2))
    console.log('')
  } catch (error) {
    console.error('❌ Error:', error.message)
  }

  // Test 6: Get RSVPs by venue
  console.log('Test 6: Get RSVPs by venue (hue)')
  try {
    const response6 = await fetch(`${baseURL}/api/rsvp/venue/hue`)
    const data6 = await response6.json()
    console.log('✅ Status:', response6.status)
    console.log('📦 Response:', JSON.stringify(data6, null, 2))
    console.log('')
  } catch (error) {
    console.error('❌ Error:', error.message)
  }

  // Test 7: Get RSVP stats
  console.log('Test 7: Get RSVP stats (hue)')
  try {
    const response7 = await fetch(`${baseURL}/api/rsvp/stats/hue`)
    const data7 = await response7.json()
    console.log('✅ Status:', response7.status)
    console.log('📦 Response:', JSON.stringify(data7, null, 2))
    console.log('')
  } catch (error) {
    console.error('❌ Error:', error.message)
  }

  console.log('✅ All tests completed!')
}

// Run tests
testRSVP().catch(console.error)
