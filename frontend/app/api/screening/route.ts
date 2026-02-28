import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface TenantApplicationData {
  fullName: string;
  email: string;
  whatsappNumber: string;
  employmentStatus: string;
  monthlyIncome: string;
  currentEmployer?: string;
  employmentDuration?: string;
  hasRentalHistory: boolean;
  currentAddress?: string;
  reasonForMoving?: string;
  hasPets: boolean;
  petDetails?: string;
  preferredMoveInDate: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  coverLetter?: string;
  numberOfOccupants?: string;
  previousLandlordContact?: string;
}

interface PropertyRequirements {
  rentAmount: number;
  securityDeposit: number;
  availableDate: string;
  petPolicy?: 'allowed' | 'not_allowed' | 'case_by_case';
  address?: string;
  city?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { applicationData, propertyRequirements, applicationId } = await request.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not configured');
      // Fall back to basic screening
      return NextResponse.json({ 
        error: 'AI screening not configured',
        fallback: true 
      }, { status: 503 });
    }

    // Prepare the prompt for Claude
    const prompt = `You are an expert property manager conducting a thorough tenant screening. Analyze this rental application and provide a detailed assessment.

PROPERTY DETAILS:
- Monthly Rent: £${propertyRequirements.rentAmount}
- Security Deposit: £${propertyRequirements.securityDeposit}
- Available Date: ${new Date(propertyRequirements.availableDate).toLocaleDateString()}
- Pet Policy: ${propertyRequirements.petPolicy || 'not specified'}
${propertyRequirements.address ? `- Location: ${propertyRequirements.address}, ${propertyRequirements.city}` : ''}

APPLICANT INFORMATION:
- Name: ${applicationData.fullName}
- Employment: ${applicationData.employmentStatus} ${applicationData.currentEmployer ? `at ${applicationData.currentEmployer}` : ''}
- Employment Duration: ${applicationData.employmentDuration || 'not specified'}
- Monthly Income: ${applicationData.monthlyIncome}
- Rental History: ${applicationData.hasRentalHistory ? 'Yes' : 'No (First-time renter)'}
- Current Address: ${applicationData.currentAddress || 'not provided'}
- Reason for Moving: ${applicationData.reasonForMoving || 'not provided'}
- Preferred Move-in Date: ${new Date(applicationData.preferredMoveInDate).toLocaleDateString()}
- Number of Occupants: ${applicationData.numberOfOccupants || '1'}
- Pets: ${applicationData.hasPets ? `Yes - ${applicationData.petDetails || 'details not provided'}` : 'No'}
${applicationData.previousLandlordContact ? `- Previous Landlord: ${applicationData.previousLandlordContact}` : ''}

${applicationData.coverLetter ? `COVER LETTER:\n${applicationData.coverLetter}\n` : ''}

Please provide a comprehensive screening analysis in the following JSON format:
{
  "score": <0.0 to 1.0>,
  "recommendation": "<approve|review|reject>",
  "summary": "<2-3 sentence executive summary>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", ...],
  "concerns": ["<specific concern 1>", "<specific concern 2>", ...],
  "riskFactors": {
    "financialRisk": "<low|medium|high>",
    "stabilityRisk": "<low|medium|high>",
    "propertyRisk": "<low|medium|high>"
  },
  "verificationNeeded": ["<item 1 to verify>", "<item 2>", ...],
  "additionalInsights": "<any patterns, red flags, or contextual observations>",
  "suggestedQuestions": ["<follow-up question 1>", "<follow-up question 2>", ...]
}

Consider factors like:
- Income-to-rent ratio (ideally 3:1 or higher)
- Employment stability and type
- Rental history and reason for moving
- Red flags in application consistency
- Property suitability for applicant's needs
- Overall reliability indicators`;

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1500,
      temperature: 0.3,
      system: "You are an expert property manager with 20 years of experience in tenant screening. You are thorough, fair, and skilled at identifying both positive indicators and potential risks. Always provide balanced, objective assessments.",
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    // Extract the response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Parse the JSON response from Claude
    let screeningResult;
    try {
      // Extract JSON from the response (Claude might include explanation text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        screeningResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Error parsing Claude response:', parseError);
      console.log('Raw response:', responseText);
      
      // Fallback structure if parsing fails
      screeningResult = {
        score: 0.5,
        recommendation: 'review',
        summary: 'AI analysis completed but requires manual review due to processing error.',
        strengths: ['Application submitted successfully'],
        concerns: ['Technical issue during AI screening - manual review recommended'],
        riskFactors: {
          financialRisk: 'medium',
          stabilityRisk: 'medium',
          propertyRisk: 'medium'
        },
        verificationNeeded: ['All information should be manually verified'],
        additionalInsights: responseText.substring(0, 500),
        suggestedQuestions: []
      };
    }

    // Enhanced details from Claude analysis
    const enhancedResult = {
      ...screeningResult,
      details: {
        incomeRatio: calculateIncomeRatio(applicationData.monthlyIncome, propertyRequirements.rentAmount),
        employmentStability: applicationData.employmentStatus,
        rentalHistoryStatus: applicationData.hasRentalHistory ? 'experienced' : 'first_time',
        moveInDateMatch: checkDateAlignment(applicationData.preferredMoveInDate, propertyRequirements.availableDate),
        petCompatibility: checkPetCompatibility(applicationData.hasPets, propertyRequirements.petPolicy),
        aiProvider: 'claude-3-sonnet'
      },
      screenedAt: new Date().toISOString()
    };

    // Save the screening result if applicationId is provided
    if (applicationId) {
      const supabase = await createClient();
      
      await supabase
        .from('property_applications')
        .update({
          ai_screening_result: enhancedResult,
          ai_screening_score: enhancedResult.score,
          status: 'under_review',
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);
    }

    return NextResponse.json(enhancedResult);

  } catch (error) {
    console.error('Screening error:', error);
    return NextResponse.json(
      { error: 'Failed to complete screening', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper functions
function calculateIncomeRatio(incomeRange: string, rentAmount: number): number {
  const range = incomeRange.split('-').map(s => parseInt(s.replace(/[^0-9]/g, '')));
  const avgIncome = (range[0] + (range[1] || range[0])) / 2;
  return avgIncome / rentAmount;
}

function checkDateAlignment(preferredDate: string, availableDate: string): boolean {
  const preferred = new Date(preferredDate);
  const available = new Date(availableDate);
  const daysDiff = Math.abs((preferred.getTime() - available.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff <= 30;
}

function checkPetCompatibility(hasPets: boolean, petPolicy?: string): boolean {
  if (!hasPets) return true;
  return petPolicy !== 'not_allowed';
}