import { createClient } from '@/lib/supabase/client';

interface TenantApplicationData {
  // Basic Info
  fullName: string;
  email: string;
  whatsappNumber: string;
  
  // Employment
  employmentStatus: string;
  monthlyIncome: string;
  currentEmployer?: string;
  employmentDuration?: string;
  
  // Rental History
  hasRentalHistory: boolean;
  currentAddress?: string;
  reasonForMoving?: string;
  
  // Additional
  hasPets: boolean;
  petDetails?: string;
  preferredMoveInDate: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

interface PropertyRequirements {
  rentAmount: number;
  securityDeposit: number;
  availableDate: string;
  petPolicy?: 'allowed' | 'not_allowed' | 'case_by_case';
}

interface ScreeningResult {
  score: number; // 0.0 to 1.0
  recommendation: 'approve' | 'review' | 'reject';
  summary: string;
  strengths: string[];
  concerns: string[];
  details: {
    incomeRatio?: number;
    employmentStability?: string;
    rentalHistoryStatus?: string;
    moveInDateMatch?: boolean;
    petCompatibility?: boolean;
  };
}

export async function screenTenant(
  applicationData: TenantApplicationData,
  propertyRequirements: PropertyRequirements
): Promise<ScreeningResult> {
  try {
    // For now, implement a rule-based screening system
    // TODO: Integrate with Claude API for more sophisticated analysis
    
    let score = 0;
    const maxPoints = 100;
    const strengths: string[] = [];
    const concerns: string[] = [];
    const details: any = {};

    // 1. Income Analysis (40 points)
    const incomeRange = applicationData.monthlyIncome.split('-').map(s => parseInt(s.replace(/[^0-9]/g, '')));
    const minIncome = incomeRange[0] || 0;
    const maxIncome = incomeRange[1] || incomeRange[0] || 0;
    const avgIncome = (minIncome + maxIncome) / 2;
    const rentAmount = propertyRequirements.rentAmount;
    const incomeRatio = avgIncome / rentAmount;
    
    details.incomeRatio = incomeRatio;
    
    if (incomeRatio >= 3) {
      score += 40;
      strengths.push(`Strong income-to-rent ratio (${incomeRatio.toFixed(1)}x)`);
    } else if (incomeRatio >= 2.5) {
      score += 30;
      strengths.push(`Adequate income-to-rent ratio (${incomeRatio.toFixed(1)}x)`);
    } else if (incomeRatio >= 2) {
      score += 20;
      concerns.push(`Income-to-rent ratio is below ideal (${incomeRatio.toFixed(1)}x)`);
    } else {
      score += 0;
      concerns.push(`Low income-to-rent ratio (${incomeRatio.toFixed(1)}x) - may struggle with payments`);
    }

    // 2. Employment Stability (30 points)
    details.employmentStability = applicationData.employmentStatus;
    
    if (applicationData.employmentStatus === 'full_time') {
      score += 20;
      
      // Additional points for employment duration
      if (applicationData.employmentDuration === '5_years_plus') {
        score += 10;
        strengths.push('Very stable employment history (5+ years)');
      } else if (applicationData.employmentDuration === '2_5_years') {
        score += 8;
        strengths.push('Stable employment history (2-5 years)');
      } else if (applicationData.employmentDuration === '1_2_years') {
        score += 5;
      } else {
        concerns.push('Recent job change (less than 1 year)');
      }
    } else if (applicationData.employmentStatus === 'self_employed') {
      score += 15;
      if (applicationData.employmentDuration && ['2_5_years', '5_years_plus'].includes(applicationData.employmentDuration)) {
        score += 10;
        strengths.push('Established self-employment');
      }
    } else if (applicationData.employmentStatus === 'part_time') {
      score += 10;
      concerns.push('Part-time employment may affect payment stability');
    } else if (applicationData.employmentStatus === 'student') {
      score += 5;
      concerns.push('Student status - may need guarantor');
    } else if (applicationData.employmentStatus === 'retired') {
      score += 15;
      strengths.push('Retired - likely stable income');
    } else {
      concerns.push('Currently unemployed');
    }

    // 3. Rental History (20 points)
    details.rentalHistoryStatus = applicationData.hasRentalHistory ? 'experienced' : 'first_time';
    
    if (applicationData.hasRentalHistory) {
      score += 15;
      strengths.push('Has previous rental experience');
      
      if (applicationData.reasonForMoving) {
        const validReasons = ['work', 'space', 'location', 'upgrade'];
        const reasonLower = applicationData.reasonForMoving.toLowerCase();
        if (validReasons.some(r => reasonLower.includes(r))) {
          score += 5;
        }
      }
    } else {
      score += 5;
      concerns.push('First-time renter - no rental history');
    }

    // 4. Move-in Date Compatibility (5 points)
    const preferredDate = new Date(applicationData.preferredMoveInDate);
    const availableDate = new Date(propertyRequirements.availableDate);
    const daysDifference = Math.abs((preferredDate.getTime() - availableDate.getTime()) / (1000 * 60 * 60 * 24));
    
    details.moveInDateMatch = daysDifference <= 30;
    
    if (daysDifference <= 7) {
      score += 5;
      strengths.push('Move-in date aligns perfectly');
    } else if (daysDifference <= 30) {
      score += 3;
    } else {
      concerns.push('Move-in date significantly misaligned');
    }

    // 5. Pet Compatibility (5 points)
    details.petCompatibility = !applicationData.hasPets || propertyRequirements.petPolicy !== 'not_allowed';
    
    if (!applicationData.hasPets) {
      score += 5;
    } else if (propertyRequirements.petPolicy === 'allowed') {
      score += 5;
      strengths.push('Pet owner - property allows pets');
    } else if (propertyRequirements.petPolicy === 'case_by_case') {
      score += 2;
      concerns.push(`Has pets: ${applicationData.petDetails || 'unspecified'}`);
    } else {
      concerns.push('Has pets but property does not allow');
    }

    // Calculate final score and recommendation
    const finalScore = score / maxPoints;
    
    let recommendation: 'approve' | 'review' | 'reject';
    if (finalScore >= 0.75) {
      recommendation = 'approve';
    } else if (finalScore >= 0.5) {
      recommendation = 'review';
    } else {
      recommendation = 'reject';
    }

    // Generate summary
    const summary = generateScreeningSummary(
      applicationData,
      finalScore,
      recommendation,
      strengths.length,
      concerns.length
    );

    return {
      score: finalScore,
      recommendation,
      summary,
      strengths,
      concerns,
      details
    };

  } catch (error) {
    console.error('Tenant screening error:', error);
    throw new Error('Failed to complete tenant screening');
  }
}

function generateScreeningSummary(
  applicationData: TenantApplicationData,
  score: number,
  recommendation: string,
  strengthCount: number,
  concernCount: number
): string {
  const scorePercent = Math.round(score * 100);
  
  let summary = `${applicationData.fullName} scored ${scorePercent}% in the automated screening. `;
  
  if (recommendation === 'approve') {
    summary += `This applicant shows strong qualifications with ${strengthCount} key strengths identified. `;
    summary += 'Recommendation: APPROVE for tenancy.';
  } else if (recommendation === 'review') {
    summary += `This applicant shows mixed qualifications with ${strengthCount} strengths but ${concernCount} areas of concern. `;
    summary += 'Recommendation: MANUAL REVIEW required before decision.';
  } else {
    summary += `This applicant has ${concernCount} significant concerns that may affect their ability to fulfill lease obligations. `;
    summary += 'Recommendation: CONSIDER REJECTION or request additional information.';
  }
  
  return summary;
}

// Function to process application and save screening results
export async function processApplicationWithScreening(
  applicationId: string,
  applicationData: TenantApplicationData,
  propertyRequirements: PropertyRequirements
) {
  const supabase = createClient();
  
  try {
    // Update application status to screening
    await supabase
      .from('property_applications')
      .update({ status: 'ai_screening' })
      .eq('id', applicationId);
    
    // Perform screening with Claude (will fall back to rule-based if needed)
    const screeningResult = await screenTenantWithClaude(applicationData, propertyRequirements, applicationId);
    
    // Save screening results
    const { error } = await supabase
      .from('property_applications')
      .update({
        ai_screening_result: screeningResult,
        ai_screening_score: screeningResult.score,
        status: 'under_review',
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId);
    
    if (error) throw error;
    
    return screeningResult;
  } catch (error) {
    console.error('Error processing application:', error);
    
    // Update status to indicate error
    await supabase
      .from('property_applications')
      .update({ 
        status: 'under_review',
        ai_screening_result: { error: 'Screening failed, manual review required' }
      })
      .eq('id', applicationId);
    
    throw error;
  }
}

// Function to integrate with Claude API
export async function screenTenantWithClaude(
  applicationData: TenantApplicationData,
  propertyRequirements: PropertyRequirements,
  applicationId?: string
): Promise<ScreeningResult> {
  try {
    // Call the API route
    const response = await fetch('/api/screening', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        applicationData,
        propertyRequirements,
        applicationId
      }),
    });

    const data = await response.json();

    // Check if we need to fallback
    if (data.fallback || !response.ok) {
      console.log('Falling back to rule-based screening:', data.error || 'API error');
      return screenTenant(applicationData, propertyRequirements);
    }

    // Transform Claude response to our ScreeningResult format
    return {
      score: data.score,
      recommendation: data.recommendation,
      summary: data.summary,
      strengths: data.strengths || [],
      concerns: data.concerns || [],
      details: {
        ...data.details,
        riskFactors: data.riskFactors,
        verificationNeeded: data.verificationNeeded,
        additionalInsights: data.additionalInsights,
        suggestedQuestions: data.suggestedQuestions,
        aiProvider: data.details?.aiProvider || 'claude'
      }
    };
  } catch (error) {
    console.error('Error calling Claude API:', error);
    // Fall back to rule-based screening
    return screenTenant(applicationData, propertyRequirements);
  }
}