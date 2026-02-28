'use client';

import { useState } from "react";
import { Settings as SettingsIcon, Brain, Bell, DollarSign, Clock, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import useStore from "@/lib/store/useStore";

export default function SettingsPage() {
  const { agentMode, autonomyLevel, setAgentMode, setAutonomyLevel } = useStore();
  const [aiTone, setAiTone] = useState("formal");
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    inApp: true
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure AI agent behavior and system preferences</p>
      </div>

      {/* AI Agent Settings */}
      <Card className="p-6 ai-glow">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-lg bg-primary/10 p-3">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">AI Agent Configuration</h3>
            <p className="text-sm text-muted-foreground">Control automation level and behavior</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Agent Mode */}
          <div>
            <Label className="text-base font-medium mb-4 block">Agent Mode</Label>
            <RadioGroup value={agentMode} onValueChange={(value) => setAgentMode(value as any)}>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 rounded-lg border hover:bg-secondary/50 cursor-pointer">
                  <RadioGroupItem value="active" id="active" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="active" className="cursor-pointer">
                      <p className="font-medium">Active Mode</p>
                      <p className="text-sm text-muted-foreground">
                        AI makes decisions and takes actions autonomously
                      </p>
                    </Label>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-4 rounded-lg border hover:bg-secondary/50 cursor-pointer">
                  <RadioGroupItem value="passive" id="passive" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="passive" className="cursor-pointer">
                      <p className="font-medium">Passive Mode</p>
                      <p className="text-sm text-muted-foreground">
                        AI suggests actions but requires approval
                      </p>
                    </Label>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-4 rounded-lg border hover:bg-secondary/50 cursor-pointer">
                  <RadioGroupItem value="off" id="off" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="off" className="cursor-pointer">
                      <p className="font-medium">Off</p>
                      <p className="text-sm text-muted-foreground">
                        Disable AI automation completely
                      </p>
                    </Label>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Autonomy Level */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label className="text-base font-medium">Autonomy Level</Label>
              <span className="text-2xl font-bold text-primary">{autonomyLevel}%</span>
            </div>
            <Slider 
              value={[autonomyLevel]} 
              onValueChange={([value]) => setAutonomyLevel(value)}
              max={100}
              step={1}
              className="mb-3"
              disabled={agentMode === 'off'}
            />
            <p className="text-sm text-muted-foreground">
              Higher levels allow the AI to handle more complex decisions independently
            </p>
          </div>

          <Separator />

          {/* AI Tone */}
          <div>
            <Label htmlFor="ai-tone" className="text-base font-medium mb-3 block">
              <MessageSquare className="inline h-4 w-4 mr-2" />
              AI Communication Tone
            </Label>
            <Select value={aiTone} onValueChange={setAiTone}>
              <SelectTrigger id="ai-tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="formal">Formal / Professional</SelectItem>
                <SelectItem value="friendly">Friendly / Casual</SelectItem>
                <SelectItem value="strict">Strict / Direct</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Late Fee Rules */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Late Fee Rules
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Automatic Late Fees</p>
              <p className="text-sm text-muted-foreground">Apply fees after grace period</p>
            </div>
            <Switch defaultChecked />
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Late Fee Amount</Label>
            <Select defaultValue="5">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3% of rent</SelectItem>
                <SelectItem value="5">5% of rent</SelectItem>
                <SelectItem value="10">10% of rent</SelectItem>
                <SelectItem value="fixed">Fixed amount</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Grace Period</Label>
            <Select defaultValue="5">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="5">5 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="10">10 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Vendor Assignment Rules */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Vendor Assignment Rules
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-assign vendors</p>
              <p className="text-sm text-muted-foreground">Based on AI performance scores</p>
            </div>
            <Switch defaultChecked />
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Priority Factor</Label>
            <Select defaultValue="response">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="response">Response Time</SelectItem>
                <SelectItem value="cost">Cost Efficiency</SelectItem>
                <SelectItem value="rating">Customer Rating</SelectItem>
                <SelectItem value="ai">AI Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Notification Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Escalations and daily summaries</p>
            </div>
            <Switch 
              checked={notifications.email}
              onCheckedChange={(checked) => setNotifications({...notifications, email: checked})}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">SMS Alerts</p>
              <p className="text-sm text-muted-foreground">Emergency issues only</p>
            </div>
            <Switch 
              checked={notifications.sms}
              onCheckedChange={(checked) => setNotifications({...notifications, sms: checked})}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">In-App Notifications</p>
              <p className="text-sm text-muted-foreground">Real-time updates</p>
            </div>
            <Switch 
              checked={notifications.inApp}
              onCheckedChange={(checked) => setNotifications({...notifications, inApp: checked})}
            />
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline">Cancel</Button>
        <Button className="ai-glow">Save Settings</Button>
      </div>
    </div>
  );
}