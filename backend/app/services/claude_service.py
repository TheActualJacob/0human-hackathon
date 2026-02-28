"""
Claude API Integration Service for Maintenance Analysis
"""
import json
from typing import Dict, Any, Optional
from anthropic import Anthropic, APIError
import asyncio
from app.config import settings

class ClaudeService:
    """Service for integrating with Claude API for maintenance request analysis."""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize Claude service with API key."""
        self.api_key = api_key or settings.ANTHROPIC_API_KEY
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment variables")
        
        self.client = Anthropic(api_key=self.api_key)
        
        # System prompt exactly as specified
        self.system_prompt = """You are an expert property maintenance operations manager.

Your task is to analyze a tenant maintenance request and determine:

1. category (plumbing, electrical, hvac, appliance, structural, pest, cosmetic, other)
2. urgency (low, medium, high, emergency)
3. estimated_cost_range (low < $200, medium $200-$800, high > $800)
4. vendor_required (true/false)
5. reasoning (clear operational explanation)
6. confidence_score (0.0 - 1.0)

Rules:
- Emergency issues include flooding, fire risk, gas smell, no heat in winter, major electrical hazard.
- Cosmetic issues (paint scratches, minor wear) do NOT require vendor immediately.
- If repair likely requires tools or technical expertise, vendor_required = true.
- If tenant can reasonably fix issue safely themselves, vendor_required = false.
- Always prioritize safety.

Return ONLY valid JSON.
No commentary.
No markdown.
No explanation outside JSON."""

    async def analyze_maintenance_request(
        self, 
        description: str,
        unit_address: Optional[str] = None,
        tenant_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze a maintenance request using Claude API.
        
        Args:
            description: The maintenance issue description from tenant
            unit_address: Optional unit address for context
            tenant_name: Optional tenant name for context
            
        Returns:
            Dict containing AI analysis with all required fields
        """
        # Build the user prompt with context
        user_prompt = f"Analyze this maintenance request:\n\n{description}"
        
        if unit_address:
            user_prompt += f"\n\nUnit: {unit_address}"
        if tenant_name:
            user_prompt += f"\nTenant: {tenant_name}"
        
        try:
            # Call Claude API with temperature 0.2 for consistency
            response = await asyncio.to_thread(
                self.client.messages.create,
                model="claude-3-5-sonnet-20241022",
                max_tokens=500,
                temperature=0.2,
                system=self.system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ]
            )
            
            # Extract the response text
            response_text = response.content[0].text.strip()
            
            # Parse JSON response
            try:
                analysis = json.loads(response_text)
            except json.JSONDecodeError as e:
                # Retry once if invalid JSON
                return await self._retry_analysis(description, unit_address, tenant_name)
            
            # Validate required fields
            required_fields = [
                'category', 'urgency', 'estimated_cost_range', 
                'vendor_required', 'reasoning', 'confidence_score'
            ]
            
            for field in required_fields:
                if field not in analysis:
                    # Retry if missing fields
                    return await self._retry_analysis(description, unit_address, tenant_name)
            
            # Validate field values
            if analysis['category'] not in ['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'pest', 'cosmetic', 'other']:
                analysis['category'] = 'other'
            
            if analysis['urgency'] not in ['low', 'medium', 'high', 'emergency']:
                analysis['urgency'] = 'medium'
                
            if analysis['estimated_cost_range'] not in ['low', 'medium', 'high']:
                analysis['estimated_cost_range'] = 'medium'
            
            if not isinstance(analysis['vendor_required'], bool):
                analysis['vendor_required'] = True
                
            if not isinstance(analysis['confidence_score'], (int, float)):
                analysis['confidence_score'] = 0.85
            else:
                # Ensure confidence score is between 0 and 1
                analysis['confidence_score'] = max(0.0, min(1.0, float(analysis['confidence_score'])))
            
            return analysis
            
        except APIError as e:
            # Handle API errors
            print(f"Claude API error: {str(e)}")
            return self._fallback_analysis(description)
        except Exception as e:
            # Handle unexpected errors
            print(f"Unexpected error in Claude analysis: {str(e)}")
            return self._fallback_analysis(description)
    
    async def _retry_analysis(
        self, 
        description: str,
        unit_address: Optional[str] = None,
        tenant_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Retry analysis once if invalid response."""
        try:
            # Add clarification to prompt
            clarified_prompt = f"""Analyze this maintenance request and return ONLY a JSON object with these exact fields:
- category
- urgency  
- estimated_cost_range
- vendor_required
- reasoning
- confidence_score

Request: {description}"""
            
            if unit_address:
                clarified_prompt += f"\nUnit: {unit_address}"
            
            response = await asyncio.to_thread(
                self.client.messages.create,
                model="claude-3-5-sonnet-20241022",
                max_tokens=500,
                temperature=0.2,
                system=self.system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": clarified_prompt
                    }
                ]
            )
            
            response_text = response.content[0].text.strip()
            
            # Try to extract JSON if wrapped in markdown
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.strip()
            
            analysis = json.loads(response_text)
            
            # Ensure all required fields
            return {
                'category': analysis.get('category', 'other'),
                'urgency': analysis.get('urgency', 'medium'),
                'estimated_cost_range': analysis.get('estimated_cost_range', 'medium'),
                'vendor_required': bool(analysis.get('vendor_required', True)),
                'reasoning': analysis.get('reasoning', 'Unable to analyze request'),
                'confidence_score': float(analysis.get('confidence_score', 0.5))
            }
            
        except Exception:
            return self._fallback_analysis(description)
    
    def _fallback_analysis(self, description: str) -> Dict[str, Any]:
        """Provide fallback analysis when Claude API fails."""
        # Simple keyword-based fallback
        desc_lower = description.lower()
        
        category = 'other'
        urgency = 'medium'
        vendor_required = True
        
        # Category detection
        if any(word in desc_lower for word in ['leak', 'water', 'pipe', 'drain', 'toilet', 'sink']):
            category = 'plumbing'
            urgency = 'high' if 'flood' in desc_lower or 'major' in desc_lower else 'medium'
        elif any(word in desc_lower for word in ['electric', 'power', 'outlet', 'light', 'switch']):
            category = 'electrical'
            urgency = 'high'
        elif any(word in desc_lower for word in ['heat', 'cooling', 'ac', 'furnace', 'temperature']):
            category = 'hvac'
            urgency = 'high' if any(word in desc_lower for word in ['no heat', 'no cooling', 'freezing']) else 'medium'
        elif any(word in desc_lower for word in ['appliance', 'fridge', 'stove', 'washer', 'dryer']):
            category = 'appliance'
        
        # Emergency detection
        if any(word in desc_lower for word in ['emergency', 'urgent', 'flood', 'fire', 'gas', 'dangerous']):
            urgency = 'emergency'
        
        return {
            'category': category,
            'urgency': urgency,
            'estimated_cost_range': 'high' if urgency == 'emergency' else 'medium',
            'vendor_required': vendor_required,
            'reasoning': 'Automated analysis based on keywords. Claude API unavailable.',
            'confidence_score': 0.6
        }
    
    async def generate_vendor_message(
        self,
        vendor_name: str,
        issue_description: str,
        urgency: str,
        unit_address: str,
        tenant_name: Optional[str] = None
    ) -> str:
        """
        Generate a professional vendor outreach message.
        
        Args:
            vendor_name: Name of the vendor/contractor
            issue_description: Description of the maintenance issue
            urgency: Urgency level
            unit_address: Property address
            tenant_name: Optional tenant name
            
        Returns:
            Professional outreach message
        """
        prompt = f"""Generate a professional, concise message to a contractor for a maintenance request.

Contractor: {vendor_name}
Issue: {issue_description}
Urgency: {urgency}
Property: {unit_address}
{"Tenant: " + tenant_name if tenant_name else ""}

Write a brief, professional message requesting their service. Include:
- Greeting
- Issue description
- Urgency level
- Request for ETA
- Professional closing

Keep it under 100 words."""

        try:
            response = await asyncio.to_thread(
                self.client.messages.create,
                model="claude-3-5-sonnet-20241022",
                max_tokens=200,
                temperature=0.3,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            return response.content[0].text.strip()
            
        except Exception:
            # Fallback message
            return f"""Hi {vendor_name},

We have a {urgency} {issue_description} at {unit_address} that requires your expertise.

Could you please provide an ETA for addressing this issue? The tenant has reported: "{issue_description}"

Thank you for your prompt attention to this matter.

Best regards,
Property Management"""